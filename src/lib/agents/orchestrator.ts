// lib/agents/orchestrator.ts
// Thin routing layer that directs requests to appropriate agents

import { createClient } from "@/lib/supabase/server";
import { runOnboardingAgent } from "./onboarding";
import { runChatAgent } from "./chat";
import { runInsightAgent } from "./insight";
import { saveUserContext } from "@/lib/tools/context";

type AgentRoute = "onboarding" | "chat" | "insight" | "import";

interface OrchestrationResult {
  route: AgentRoute;
  response: string;
  conversationId?: string;
  contextUpdated?: boolean;
}

interface UserContextRow {
  onboarding_complete: boolean;
}

interface OnboardingStateRow {
  phase: string;
}

export async function orchestrate(
  userId: string,
  userMessage: string,
  conversationId?: string
): Promise<OrchestrationResult> {
  const supabase = await createClient();

  // Check user state
  const { data: userContextData } = await supabase
    .from("user_context")
    .select("onboarding_complete")
    .eq("user_id", userId)
    .single();

  const userContext = userContextData as UserContextRow | null;
  const isOnboarded = userContext?.onboarding_complete === true;

  // Check if there's an active onboarding session
  const { data: onboardingData } = await supabase
    .from("onboarding_state")
    .select("phase")
    .eq("user_id", userId)
    .single();

  const onboardingState = onboardingData as OnboardingStateRow | null;
  const hasActiveOnboarding = onboardingState && onboardingState.phase !== "complete";

  // Route decision
  if (!isOnboarded || hasActiveOnboarding) {
    // New user or mid-onboarding -> Onboarding Agent
    const result = await runOnboardingAgent(userId, userMessage, conversationId);

    if (result.complete && result.context) {
      // Onboarding finished - save context
      await saveUserContext(userId, result.context);
      return {
        route: "onboarding",
        response: result.response,
        conversationId: result.conversationId,
        contextUpdated: true,
      };
    }

    return {
      route: "onboarding",
      response: result.response,
      conversationId: result.conversationId,
    };
  }

  // Onboarded user - route based on intent
  const route = classifyIntent(userMessage);

  switch (route) {
    case "insight":
      // User asking for insight/summary
      const insight = await runInsightAgent(userId);
      return { route: "insight", response: insight };

    case "chat":
    default:
      // General question or conversation
      const chatResult = await runChatAgent(userId, userMessage, conversationId);
      return {
        route: "chat",
        response: chatResult.response,
        conversationId: chatResult.conversationId,
      };
  }
}

function classifyIntent(message: string): AgentRoute {
  // Quick classification using heuristics
  const lowerMessage = message.toLowerCase();

  // Insight triggers
  const insightKeywords = [
    "summary",
    "how am i doing",
    "update",
    "insight",
    "overview",
    "status",
    "how's my spending",
    "how is my spending",
    "check in",
    "checkin",
  ];

  for (const keyword of insightKeywords) {
    if (lowerMessage.includes(keyword)) {
      return "insight";
    }
  }

  return "chat";
}

// Helper to start a fresh onboarding
export async function startOnboarding(userId: string): Promise<OrchestrationResult> {
  const supabase = await createClient();

  // Clear any existing onboarding state
  await supabase.from("onboarding_state").delete().eq("user_id", userId);

  // Start fresh
  return orchestrate(userId, "hi");
}

// Helper to check if user needs onboarding
export async function needsOnboarding(userId: string): Promise<boolean> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("user_context")
    .select("onboarding_complete")
    .eq("user_id", userId)
    .single();

  const row = data as { onboarding_complete: boolean } | null;
  return !row?.onboarding_complete;
}
