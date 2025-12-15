import { createClient } from "@/lib/supabase/server";
import { orchestrate, needsOnboarding } from "@/lib/agents/orchestrator";
import { NextResponse } from "next/server";

export const maxDuration = 60;

// POST /api/orchestrate - Main chat endpoint with intelligent routing
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { message, conversationId } = await request.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const result = await orchestrate(user.id, message, conversationId);

    return NextResponse.json({
      response: result.response,
      route: result.route,
      conversationId: result.conversationId,
      contextUpdated: result.contextUpdated || false,
    });
  } catch (error) {
    console.error("Orchestration error:", error);
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 }
    );
  }
}

// GET /api/orchestrate - Check onboarding status
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const onboardingNeeded = await needsOnboarding(user.id);
    return NextResponse.json({ needsOnboarding: onboardingNeeded });
  } catch (error) {
    console.error("Error checking onboarding status:", error);
    return NextResponse.json(
      { error: "Failed to check status" },
      { status: 500 }
    );
  }
}
