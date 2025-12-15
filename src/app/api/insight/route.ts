import { createClient } from "@/lib/supabase/server";
import { runInsightAgent, getRecentInsights } from "@/lib/agents/insight";
import { NextResponse } from "next/server";

export const maxDuration = 30;

// GET /api/insight - Get current insight or recent insights
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const history = url.searchParams.get("history");

  if (history === "true") {
    // Return recent insights
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const insights = await getRecentInsights(user.id, limit);
    return NextResponse.json({ insights });
  }

  // Generate fresh insight
  try {
    const insight = await runInsightAgent(user.id);
    return NextResponse.json({ insight });
  } catch (error) {
    console.error("Error generating insight:", error);
    return NextResponse.json(
      { error: "Failed to generate insight" },
      { status: 500 }
    );
  }
}
