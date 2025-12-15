// Shared tools for all agents
import Anthropic from "@anthropic-ai/sdk";
import { getTransactions, getSpendingSummary, getRecentActivity } from "./transactions";
import {
  getUserContext,
  updateUserContext,
  getOnboardingState,
  saveOnboardingState,
  saveUserContext,
} from "./context";
import { createClient } from "@/lib/supabase/server";

// Transaction tools - for querying financial data
export const transactionTools: Anthropic.Tool[] = [
  {
    name: "get_transactions",
    description:
      "Fetch transactions with optional filters. Use for questions about specific spending, merchants, or time periods.",
    input_schema: {
      type: "object" as const,
      properties: {
        start_date: {
          type: "string",
          description: "Start date in ISO format (YYYY-MM-DD)",
        },
        end_date: {
          type: "string",
          description: "End date in ISO format (YYYY-MM-DD)",
        },
        category: {
          type: "string",
          description: "Filter by category name",
        },
        classification: {
          type: "string",
          enum: ["Essential", "Discretionary", "Non-Spending", "Income"],
          description: "Filter by classification",
        },
        merchant: {
          type: "string",
          description: "Search by merchant name (partial match)",
        },
        min_amount: {
          type: "number",
          description: "Minimum transaction amount",
        },
        max_amount: {
          type: "number",
          description: "Maximum transaction amount",
        },
        limit: {
          type: "number",
          description: "Maximum results to return (default 50)",
        },
      },
    },
  },
  {
    name: "get_spending_summary",
    description:
      "Get aggregated spending summary for a period. Returns totals by category or classification.",
    input_schema: {
      type: "object" as const,
      properties: {
        start_date: {
          type: "string",
          description: "Start date in ISO format",
        },
        end_date: {
          type: "string",
          description: "End date in ISO format",
        },
        group_by: {
          type: "string",
          enum: ["category", "classification", "merchant"],
          description: "How to group the results",
        },
      },
      required: ["start_date", "end_date", "group_by"],
    },
  },
  {
    name: "get_recent_activity",
    description:
      "Get recent transaction activity - useful for understanding current spending patterns",
    input_schema: {
      type: "object" as const,
      properties: {
        days: {
          type: "number",
          description: "Number of days to look back (default 30)",
        },
      },
    },
  },
];

// Context tools - for reading/updating user context
export const contextTools: Anthropic.Tool[] = [
  {
    name: "get_user_context",
    description: "Get the user's financial context including trade-offs, patterns, and targets",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "update_user_context",
    description:
      "Update parts of the user's context. Use when user reveals new information about their finances.",
    input_schema: {
      type: "object" as const,
      properties: {
        field: {
          type: "string",
          enum: [
            "household_members",
            "deliberate_tradeoffs",
            "non_negotiables",
            "watch_patterns",
            "seasonal_patterns",
            "spending_targets",
            "context_narrative",
          ],
          description: "Which field to update",
        },
        action: {
          type: "string",
          enum: ["set", "append", "remove"],
          description: "How to update: set replaces, append adds to array, remove deletes from array",
        },
        value: {
          description: "The value to set/append/remove",
        },
      },
      required: ["field", "action", "value"],
    },
  },
  {
    name: "add_merchant_mapping",
    description: "Learn a merchant to category mapping for auto-categorization",
    input_schema: {
      type: "object" as const,
      properties: {
        merchant_pattern: {
          type: "string",
          description: "The merchant name pattern to match (case insensitive)",
        },
        category: {
          type: "string",
          description: "The category to assign",
        },
        classification: {
          type: "string",
          enum: ["Essential", "Discretionary", "Non-Spending", "Income"],
          description: "Optional classification override",
        },
      },
      required: ["merchant_pattern", "category"],
    },
  },
];

// Tool execution
export async function executeTool(
  userId: string,
  toolName: string,
  input: Record<string, unknown>
): Promise<unknown> {
  switch (toolName) {
    case "get_transactions":
      return getTransactions(userId, input);

    case "get_spending_summary":
      return getSpendingSummary(userId, input as {
        start_date: string;
        end_date: string;
        group_by: "category" | "classification" | "merchant";
      });

    case "get_recent_activity":
      return getRecentActivity(userId, (input.days as number) || 30);

    case "get_user_context":
      return getUserContext(userId);

    case "update_user_context":
      return updateUserContext(userId, input as {
        field: string;
        action: "set" | "append" | "remove";
        value: unknown;
      });

    case "add_merchant_mapping":
      return addMerchantMapping(userId, input as {
        merchant_pattern: string;
        category: string;
        classification?: string;
      });

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// Helper function for adding merchant mappings
async function addMerchantMapping(
  userId: string,
  params: { merchant_pattern: string; category: string; classification?: string }
) {
  const supabase = await createClient();

  // Verify category exists
  const { data: categoryDataRaw } = await supabase
    .from("categories")
    .select("classification")
    .eq("name", params.category)
    .single();

  const categoryData = categoryDataRaw as { classification: string } | null;

  if (!categoryData) {
    return { error: `Invalid category: ${params.category}` };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("merchant_mappings") as any).upsert(
    {
      user_id: userId,
      merchant_pattern: params.merchant_pattern.toLowerCase(),
      category: params.category,
      classification: params.classification || categoryData.classification,
    },
    { onConflict: "user_id,merchant_pattern" }
  );

  if (error) {
    return { error: error.message };
  }

  return {
    success: true,
    message: `Learned: "${params.merchant_pattern}" -> ${params.category}`,
  };
}

// Re-export context functions for use by agents
export { getUserContext, updateUserContext, getOnboardingState, saveOnboardingState, saveUserContext };
