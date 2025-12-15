import { z } from "zod";

// Tool parameter schemas - these are used by the API route
export const toolSchemas = {
  queryTransactions: z.object({
    category: z.string().optional().describe("Filter by exact category name (e.g., 'Groceries', 'Dining Out')"),
    classification: z
      .enum(["Essential", "Discretionary", "Non-Spending", "Income"])
      .optional()
      .describe("Filter by spending classification"),
    merchant: z.string().optional().describe("Search by merchant name (partial match, case insensitive)"),
    minAmount: z.number().optional().describe("Minimum transaction amount"),
    maxAmount: z.number().optional().describe("Maximum transaction amount"),
    startDate: z.string().optional().describe("Start date in YYYY-MM-DD format"),
    endDate: z.string().optional().describe("End date in YYYY-MM-DD format"),
    limit: z.number().optional().default(20).describe("Maximum number of results to return"),
    needsReview: z.boolean().optional().describe("Only show transactions flagged for review"),
  }),

  getMonthlySummary: z.object({
    month: z.string().describe("Month in YYYY-MM format (e.g., '2025-11' for November 2025)"),
    compareToLast: z.boolean().optional().default(false).describe("Include comparison to previous month"),
  }),

  getBudgetStatus: z.object({
    month: z.string().optional().describe("Month in YYYY-MM format, defaults to current month"),
    category: z.string().optional().describe("Specific category to check, or omit for all"),
  }),

  getSubscriptions: z.object({
    minOccurrences: z.number().optional().default(2).describe("Minimum times a transaction must repeat to be considered recurring"),
  }),

  categorizeTransaction: z.object({
    transactionId: z.string().describe("The transaction ID to update"),
    category: z.string().describe("The category to assign (must be a valid category name)"),
    notes: z.string().optional().describe("Optional notes about why this categorization was chosen"),
  }),

  addMerchantMapping: z.object({
    merchantPattern: z.string().describe("The merchant name or pattern to match (case insensitive)"),
    category: z.string().describe("The category to assign to this merchant"),
    notes: z.string().optional().describe("Optional notes about this mapping"),
  }),

  setBudget: z.object({
    category: z.string().describe("The category to budget for"),
    amount: z.number().describe("The monthly budget amount in dollars"),
    notes: z.string().optional().describe("Optional notes about this budget"),
  }),
};

// Tool descriptions for Claude
export const toolDescriptions = {
  queryTransactions:
    "Search and filter transactions. Use for questions like 'how much did I spend on groceries?' or 'show me all Bunnings purchases'. Returns a list of matching transactions with amounts.",
  getMonthlySummary:
    "Get spending summary for a specific month. Returns totals by category and classification breakdown. Use for questions like 'how did I do last month?' or 'show me November spending'.",
  getBudgetStatus:
    "Check how spending compares to budget for the current or specified month. Use for questions like 'am I on track this month?' or 'how's my dining out budget?'",
  getSubscriptions:
    "Identify recurring subscriptions from transaction history. Shows monthly and annual costs. Use for questions like 'what subscriptions do I have?' or 'how much am I spending on streaming?'",
  categorizeTransaction:
    "Update the category of a transaction. Use when the user confirms what category a transaction should be. This also clears the needs_review flag.",
  addMerchantMapping:
    "Learn a new merchant to category mapping for future imports. Use when the user wants to set a default category for a merchant.",
  setBudget: "Set or update a monthly budget for a category. Use when the user wants to set spending limits.",
};
