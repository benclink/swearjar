// lib/agents/insight.ts
// Single-turn insight generation agent

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/tools/context";
import { getSpendingSummary, getRecentActivity } from "@/lib/tools/transactions";

const client = new Anthropic();

export async function runInsightAgent(userId: string): Promise<string> {
  // Gather all the data the insight needs
  const context = await getUserContext(userId);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  // Format dates as YYYY-MM-DD for the database queries
  const formatDate = (d: Date) => d.toISOString().split("T")[0];

  const [currentMonth, lastMonth, recentActivity] = await Promise.all([
    getSpendingSummary(userId, {
      start_date: formatDate(startOfMonth),
      end_date: formatDate(now),
      group_by: "category",
    }),
    getSpendingSummary(userId, {
      start_date: formatDate(startOfLastMonth),
      end_date: formatDate(endOfLastMonth),
      group_by: "category",
    }),
    getRecentActivity(userId, 14), // Last 2 weeks
  ]);

  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const percentThroughMonth = Math.round((dayOfMonth / daysInMonth) * 100);

  // Check for seasonal context
  const currentMonthNum = now.getMonth() + 1;
  const activeSeasonalPatterns = context.seasonal_patterns.filter((p) =>
    p.months.includes(currentMonthNum)
  );

  const systemPrompt = `You're generating the ONE insight that matters most right now for this user's spending.

## Their Financial Context
${context.context_narrative || "No context narrative available yet."}

## Deliberate Trade-offs (DO NOT flag these as problems)
${JSON.stringify(context.deliberate_tradeoffs, null, 2)}

## Non-negotiables (DO NOT suggest cutting)
${JSON.stringify(context.non_negotiables, null, 2)}

## Patterns to Watch
${JSON.stringify(context.watch_patterns, null, 2)}

## Active Seasonal Context
${activeSeasonalPatterns.length > 0 ? JSON.stringify(activeSeasonalPatterns, null, 2) : "None active this month"}

## Their Targets
${JSON.stringify(context.spending_targets, null, 2)}

---

## This Month's Data
We're ${percentThroughMonth}% through the month (day ${dayOfMonth} of ${daysInMonth}).

Spending by category this month:
${JSON.stringify(currentMonth, null, 2)}

Last month for comparison:
${JSON.stringify(lastMonth, null, 2)}

Recent activity (last 2 weeks):
${JSON.stringify(recentActivity, null, 2)}

---

Generate ONE insight. Priority order:
1. ALERTS: Over target, something unusual or concerning
2. WARNINGS: On pace to exceed budget, emerging problem pattern
3. WATCH PATTERNS: Any of their defined watch patterns triggered
4. OBSERVATIONS: Notable but not urgent
5. AFFIRMATIONS: On track, nothing to worry about

Rules:
- NEVER flag deliberate trade-offs or non-negotiables as problems
- Be specific: name merchants, amounts, dates
- Account for active seasonal patterns (e.g., December = holiday spending)
- If there's an actionable insight, make it concrete
- Keep it under 60 words unless detail is essential
- If everything's genuinely fine, just say so briefly
- Use Australian date format (DD/MM) and currency ($AUD)

Output the insight directly. No greeting, no preamble, no "Here's your insight:".`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 300,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: "Generate my spending insight.",
      },
    ],
  });

  const textContent = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );

  const insightText = textContent?.text || "";

  // Determine priority based on content
  const priority = determineInsightPriority(insightText);

  // Store the insight for history
  await storeInsight(userId, insightText, priority, {
    currentMonth,
    lastMonth,
    recentActivity,
    dayOfMonth,
    daysInMonth,
    percentThroughMonth,
  });

  return insightText;
}

// Determine insight priority from the text
function determineInsightPriority(text: string): "alert" | "warning" | "watch" | "observation" | "affirmation" {
  const lowerText = text.toLowerCase();

  if (
    lowerText.includes("over budget") ||
    lowerText.includes("exceeded") ||
    lowerText.includes("alert") ||
    lowerText.includes("concerning")
  ) {
    return "alert";
  }

  if (
    lowerText.includes("on pace to") ||
    lowerText.includes("heading towards") ||
    lowerText.includes("warning") ||
    lowerText.includes("watch out")
  ) {
    return "warning";
  }

  if (lowerText.includes("pattern") || lowerText.includes("noticed")) {
    return "watch";
  }

  if (
    lowerText.includes("on track") ||
    lowerText.includes("looking good") ||
    lowerText.includes("well done") ||
    lowerText.includes("all good")
  ) {
    return "affirmation";
  }

  return "observation";
}

// Store insight in database
async function storeInsight(
  userId: string,
  content: string,
  priority: "alert" | "warning" | "watch" | "observation" | "affirmation",
  dataSnapshot: Record<string, unknown>
): Promise<void> {
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("insights") as any).insert({
    user_id: userId,
    content,
    priority,
    data_snapshot: dataSnapshot,
  });
}

// Get recent insights for a user
export async function getRecentInsights(
  userId: string,
  limit: number = 10
): Promise<Array<{ content: string; priority: string; created_at: string }>> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("insights")
    .select("content, priority, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data as Array<{ content: string; priority: string; created_at: string }>) || [];
}
