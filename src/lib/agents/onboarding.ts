// lib/agents/onboarding.ts
// Multi-turn onboarding interview that extracts deep financial context

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { transactionTools, contextTools, executeTool } from "@/lib/tools";
import { UserContext, OnboardingPhase } from "@/lib/types/context";
import { getOnboardingState, saveOnboardingState } from "@/lib/tools/context";

const client = new Anthropic();

interface OnboardingStateInternal {
  phase: OnboardingPhase;
  gatheredContext: Partial<UserContext>;
  questionsAsked: string[];
}

export interface OnboardingResult {
  response: string;
  complete: boolean;
  context?: UserContext;
  conversationId?: string;
}

const ONBOARDING_SYSTEM_PROMPT = `You are conducting an onboarding interview to understand a user's financial situation deeply. Your goal is to extract context that will make future insights actually useful—not generic advice.

You have access to their transaction data. USE IT. Don't ask questions you can answer from the data. Instead:
1. Make observations about what you see in their spending
2. Ask about the WHY behind patterns you notice
3. Identify deliberate trade-offs vs problem areas
4. Learn what to watch vs what to ignore

Personality: Sharp financial advisor who's done their homework. Direct, curious, non-judgmental. You're trying to understand their system, not fix it.

Interview phases:
1. intro - Introduce yourself, explain what you'll be doing, make them comfortable
2. household - Who's in the household, who manages what, joint vs separate finances
3. groceries - Meal delivery services, grocery stores, any deliberate trade-offs (e.g., "we pay more for convenience")
4. transport - Commute costs, car situation, tolls, fuel patterns
5. subscriptions - What's intentional vs forgotten, streaming, software, gym
6. bnpl - How they use BNPL (Zip, Afterpay), any active balances
7. lifestyle - Dining out, entertainment, what's sacred vs cuttable
8. synthesis - Play back everything you've learned, confirm understanding

At each phase:
- Lead with a specific observation from their data (use the tools!)
- Ask the question that reveals the reasoning behind what you see
- Confirm your understanding before transitioning to the next phase

When you've covered all phases in synthesis, use complete_onboarding with the full structured context.

IMPORTANT: Use transition_phase to move between phases. Use complete_onboarding only when you've covered everything and confirmed in synthesis.

Keep responses conversational and concise. This is a dialogue, not an interrogation.`;

export async function runOnboardingAgent(
  userId: string,
  userMessage: string,
  conversationId?: string
): Promise<OnboardingResult> {
  const supabase = await createClient();

  // Load or create onboarding state
  const rawState = await getOnboardingState(userId, conversationId);
  const state: OnboardingStateInternal = {
    phase: rawState.phase,
    gatheredContext: rawState.gathered_context,
    questionsAsked: rawState.questions_asked,
  };

  // Load or create conversation
  let convId = conversationId;
  if (!convId) {
    // Create new conversation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newConv } = await (supabase.from("conversations") as any)
      .insert({
        user_id: userId,
        agent_type: "onboarding",
        title: "Financial Context Setup",
      })
      .select("id")
      .single();
    convId = (newConv as { id: string } | null)?.id;
  }

  // Load conversation history
  const history = await getConversationHistory(supabase, convId);

  // Build messages array
  const messages: Anthropic.MessageParam[] = [
    ...history,
    { role: "user", content: userMessage },
  ];

  // Add phase context to system prompt
  const systemPrompt = `${ONBOARDING_SYSTEM_PROMPT}

Current phase: ${state.phase}
Context gathered so far:
${JSON.stringify(state.gatheredContext, null, 2)}

Questions already asked (don't repeat):
${state.questionsAsked.join("\n")}`;

  // Run the agent loop
  let response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: systemPrompt,
    tools: [...transactionTools, ...contextTools, ...onboardingTools],
    messages,
  });

  // Track if onboarding was completed
  let finalContext: UserContext | undefined;

  // Handle tool use
  while (response.stop_reason === "tool_use") {
    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async (toolUse) => {
        // Special handling for onboarding-specific tools
        if (toolUse.name === "transition_phase") {
          const input = toolUse.input as { next_phase: string; gathered: object; question_asked?: string };
          state.phase = input.next_phase as OnboardingPhase;
          Object.assign(state.gatheredContext, input.gathered);
          if (input.question_asked) {
            state.questionsAsked.push(input.question_asked);
          }
          await saveOnboardingState(userId, convId, {
            phase: state.phase,
            gathered_context: state.gatheredContext,
            questions_asked: state.questionsAsked,
          });

          return {
            type: "tool_result" as const,
            tool_use_id: toolUse.id,
            content: `Transitioned to phase: ${input.next_phase}`,
          };
        }

        if (toolUse.name === "complete_onboarding") {
          const input = toolUse.input as { final_context: UserContext };
          finalContext = input.final_context;
          state.phase = "complete";
          await saveOnboardingState(userId, convId, {
            phase: "complete",
            gathered_context: input.final_context,
            questions_asked: state.questionsAsked,
          });

          return {
            type: "tool_result" as const,
            tool_use_id: toolUse.id,
            content: "Onboarding complete! Context has been saved.",
          };
        }

        // Standard tool execution
        const result = await executeTool(
          userId,
          toolUse.name,
          toolUse.input as Record<string, unknown>
        );
        return {
          type: "tool_result" as const,
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        };
      })
    );

    // Continue the conversation with tool results
    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });

    response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      tools: [...transactionTools, ...contextTools, ...onboardingTools],
      messages,
    });
  }

  // Extract text response
  const textContent = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );

  // Save conversation messages
  await saveConversationMessages(supabase, convId!, userId, userMessage, response.content);

  // Check if complete
  const isComplete = state.phase === "complete";

  return {
    response: textContent?.text || "",
    complete: isComplete,
    context: isComplete ? (finalContext || state.gatheredContext as UserContext) : undefined,
    conversationId: convId,
  };
}

// Onboarding-specific tools
const onboardingTools: Anthropic.Tool[] = [
  {
    name: "transition_phase",
    description:
      "Move to the next onboarding phase after gathering sufficient context for the current phase. Call this when you've learned what you need from the current phase.",
    input_schema: {
      type: "object" as const,
      properties: {
        next_phase: {
          type: "string",
          enum: [
            "household",
            "groceries",
            "transport",
            "subscriptions",
            "bnpl",
            "lifestyle",
            "synthesis",
            "complete",
          ],
          description: "The phase to transition to",
        },
        gathered: {
          type: "object",
          description: "Context gathered in the current phase to merge into overall context",
        },
        question_asked: {
          type: "string",
          description: "The main question you asked in this phase (to avoid repeating)",
        },
      },
      required: ["next_phase", "gathered"],
    },
  },
  {
    name: "complete_onboarding",
    description:
      "Finalize onboarding with the complete structured context. Only call this after synthesis phase when you've confirmed understanding with the user.",
    input_schema: {
      type: "object" as const,
      properties: {
        final_context: {
          type: "object",
          description: "The complete UserContext object with all gathered information",
          properties: {
            household_members: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  role: { type: "string" },
                  tendencies: { type: "array", items: { type: "string" } },
                },
              },
            },
            deliberate_tradeoffs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  item: { type: "string" },
                  reasoning: { type: "string" },
                  do_not_flag: { type: "boolean" },
                },
              },
            },
            non_negotiables: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  item: { type: "string" },
                  reason: { type: "string" },
                },
              },
            },
            watch_patterns: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  pattern: { type: "string" },
                  description: { type: "string" },
                  meaning: { type: "string" },
                  action: { type: "string" },
                },
              },
            },
            seasonal_patterns: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  months: { type: "array", items: { type: "number" } },
                  categories: { type: "array", items: { type: "string" } },
                  note: { type: "string" },
                },
              },
            },
            spending_targets: {
              type: "object",
              properties: {
                discretionary_pct: { type: "number" },
                specific: { type: "object" },
              },
            },
            context_narrative: {
              type: "string",
              description: "A paragraph summarizing their financial situation and priorities",
            },
          },
          required: ["household_members", "deliberate_tradeoffs", "non_negotiables", "watch_patterns", "spending_targets", "context_narrative"],
        },
      },
      required: ["final_context"],
    },
  },
];

// Helper to get conversation history
async function getConversationHistory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  conversationId?: string
): Promise<Anthropic.MessageParam[]> {
  if (!conversationId) return [];

  const { data } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (!data) return [];

  const messages = data as Array<{ role: string; content: string }>;

  return messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
}

// Helper to save conversation messages
async function saveConversationMessages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  conversationId: string,
  _userId: string,
  userMessage: string,
  assistantContent: Anthropic.ContentBlock[]
): Promise<void> {
  // Save user message
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("messages") as any).insert({
    conversation_id: conversationId,
    role: "user",
    content: userMessage,
  });

  // Save assistant response
  const textContent = assistantContent.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );

  if (textContent) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("messages") as any).insert({
      conversation_id: conversationId,
      role: "assistant",
      content: textContent.text,
    });
  }
}
