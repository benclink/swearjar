import { streamText, tool } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { createClient } from "@/lib/supabase/server";
import { toolSchemas, toolDescriptions } from "@/lib/agents/tools";
import {
  handleQueryTransactions,
  handleGetMonthlySummary,
  handleGetBudgetStatus,
  handleGetSubscriptions,
  handleCategorizeTransaction,
  handleAddMerchantMapping,
  handleSetBudget,
} from "@/lib/agents/tool-handlers";

export const maxDuration = 60;

const SYSTEM_PROMPT = `You are a helpful personal finance assistant for an Australian family. You help track spending, manage budgets, and provide financial insights.

## Your Capabilities
You have access to tools to:
- Query and search transactions
- Get monthly spending summaries
- Check budget status
- Identify recurring subscriptions
- Categorize transactions
- Add merchant mappings for auto-categorization
- Set and manage budgets

## Currency & Locale
- All amounts are in Australian Dollars (AUD)
- Format currency as $X,XXX.XX
- Dates should be in Australian format (DD/MM/YYYY)

## Spending Classifications
Transactions are classified as:
- **Essential**: Necessary spending (groceries, utilities, healthcare, transport, mortgage, loan repayments)
- **Discretionary**: Lifestyle spending (dining out, entertainment, subscriptions, shopping)
- **Non-Spending**: Transfers and income

## Health Guidelines
- Discretionary spending should ideally be ≤35% of total spending
- Flag if discretionary exceeds 40%
- Monthly subscription audit is recommended

## Response Style
- Be concise and direct
- Use bullet points for lists
- Always show actual numbers from the data
- Explain categorizations when asked
- Suggest actionable improvements when relevant
- Be encouraging but honest about spending patterns

## Important
- ALWAYS use the tools to get real data - never guess or make up numbers
- If a query returns no results, say so clearly
- When categorizing, explain your reasoning
- For unknown merchants, suggest likely categories based on the name

## Current Date
Today is ${new Date().toLocaleDateString("en-AU", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.
When users say "this month" or "last month", calculate the correct YYYY-MM format.`;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = user.id;
  const { messages } = await request.json();

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: SYSTEM_PROMPT,
    messages,
    tools: {
      queryTransactions: tool({
        description: toolDescriptions.queryTransactions,
        parameters: toolSchemas.queryTransactions,
        execute: async (params) => handleQueryTransactions(params, userId),
      }),
      getMonthlySummary: tool({
        description: toolDescriptions.getMonthlySummary,
        parameters: toolSchemas.getMonthlySummary,
        execute: async (params) => handleGetMonthlySummary(params, userId),
      }),
      getBudgetStatus: tool({
        description: toolDescriptions.getBudgetStatus,
        parameters: toolSchemas.getBudgetStatus,
        execute: async (params) => handleGetBudgetStatus(params, userId),
      }),
      getSubscriptions: tool({
        description: toolDescriptions.getSubscriptions,
        parameters: toolSchemas.getSubscriptions,
        execute: async (params) => handleGetSubscriptions(params, userId),
      }),
      categorizeTransaction: tool({
        description: toolDescriptions.categorizeTransaction,
        parameters: toolSchemas.categorizeTransaction,
        execute: async (params) => handleCategorizeTransaction(params, userId),
      }),
      addMerchantMapping: tool({
        description: toolDescriptions.addMerchantMapping,
        parameters: toolSchemas.addMerchantMapping,
        execute: async (params) => handleAddMerchantMapping(params, userId),
      }),
      setBudget: tool({
        description: toolDescriptions.setBudget,
        parameters: toolSchemas.setBudget,
        execute: async (params) => handleSetBudget(params, userId),
      }),
    },
    maxSteps: 5,
    toolChoice: "auto",
  });

  return result.toDataStreamResponse();
}
