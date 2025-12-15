import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { toolSchemas } from "./tools";

type QueryTransactionsParams = z.infer<typeof toolSchemas.queryTransactions>;
type MonthlySummaryParams = z.infer<typeof toolSchemas.getMonthlySummary>;
type BudgetStatusParams = z.infer<typeof toolSchemas.getBudgetStatus>;
type SubscriptionsParams = z.infer<typeof toolSchemas.getSubscriptions>;
type CategorizeParams = z.infer<typeof toolSchemas.categorizeTransaction>;
type MerchantMappingParams = z.infer<typeof toolSchemas.addMerchantMapping>;
type SetBudgetParams = z.infer<typeof toolSchemas.setBudget>;

// Explicit types for Supabase query results
interface TransactionRow {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string | null;
  classification: string | null;
  merchant_normalised: string | null;
  needs_review: boolean;
}

interface SpendingRow {
  amount: number;
  category: string | null;
  classification: string | null;
}

interface BudgetRow {
  id: string;
  category: string;
  amount: number;
}

interface SubscriptionRow {
  merchant_normalised: string | null;
  amount: number;
  category: string | null;
  date: string;
}

interface CategoryRow {
  classification: string;
}

interface CategoryNameRow {
  name: string;
}

export async function handleQueryTransactions(params: QueryTransactionsParams, userId: string) {
  const supabase = await createClient();
  const { category, classification, merchant, minAmount, maxAmount, startDate, endDate, limit, needsReview } = params;

  let query = supabase
    .from("transactions")
    .select("id, date, description, amount, category, classification, merchant_normalised, needs_review")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(limit || 20);

  if (category) query = query.eq("category", category);
  if (classification) query = query.eq("classification", classification);
  if (merchant) query = query.ilike("merchant_normalised", `%${merchant}%`);
  if (minAmount !== undefined) query = query.gte("amount", minAmount);
  if (maxAmount !== undefined) query = query.lte("amount", maxAmount);
  if (startDate) query = query.gte("date", startDate);
  if (endDate) query = query.lte("date", endDate);
  if (needsReview) query = query.eq("needs_review", true);

  const { data: rawData, error } = await query;
  const data = rawData as TransactionRow[] | null;

  if (error) {
    return { error: error.message };
  }

  const total = data?.reduce((sum, t) => sum + (t.amount > 0 ? t.amount : 0), 0) || 0;

  return {
    transactions: data,
    count: data?.length || 0,
    totalSpending: total,
    summary: `Found ${data?.length || 0} transactions totaling $${total.toFixed(2)}`,
  };
}

export async function handleGetMonthlySummary(params: MonthlySummaryParams, userId: string) {
  const supabase = await createClient();
  const { month, compareToLast } = params;

  const [year, monthNum] = month.split("-").map(Number);
  const startDate = new Date(year, monthNum - 1, 1).toISOString().split("T")[0];
  const endDate = new Date(year, monthNum, 0).toISOString().split("T")[0];

  const { data: transactionsRaw } = await supabase
    .from("transactions")
    .select("amount, category, classification")
    .eq("user_id", userId)
    .gte("date", startDate)
    .lte("date", endDate)
    .gt("amount", 0)
    .in("classification", ["Essential", "Discretionary"]);

  const transactions = transactionsRaw as SpendingRow[] | null;

  const byCategory: Record<string, number> = {};
  const byClassification: Record<string, number> = { Essential: 0, Discretionary: 0 };

  transactions?.forEach((t) => {
    const cat = t.category || "Uncategorized";
    byCategory[cat] = (byCategory[cat] || 0) + t.amount;
    if (t.classification === "Essential" || t.classification === "Discretionary") {
      byClassification[t.classification] += t.amount;
    }
  });

  const total = byClassification.Essential + byClassification.Discretionary;
  const discretionaryPercent = total > 0 ? (byClassification.Discretionary / total) * 100 : 0;

  const topCategories = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 }));

  let comparison = null;
  if (compareToLast) {
    const prevStartDate = new Date(year, monthNum - 2, 1).toISOString().split("T")[0];
    const prevEndDate = new Date(year, monthNum - 1, 0).toISOString().split("T")[0];

    const { data: prevTransactionsRaw } = await supabase
      .from("transactions")
      .select("amount, classification")
      .eq("user_id", userId)
      .gte("date", prevStartDate)
      .lte("date", prevEndDate)
      .gt("amount", 0)
      .in("classification", ["Essential", "Discretionary"]);

    const prevTransactions = prevTransactionsRaw as SpendingRow[] | null;
    const prevTotal = prevTransactions?.reduce((sum, t) => sum + t.amount, 0) || 0;
    const change = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0;

    comparison = {
      previousMonth: prevTotal,
      change: Math.round(change * 10) / 10,
      direction: change > 0 ? "up" : change < 0 ? "down" : "flat",
    };
  }

  return {
    month,
    total: Math.round(total * 100) / 100,
    essential: Math.round(byClassification.Essential * 100) / 100,
    discretionary: Math.round(byClassification.Discretionary * 100) / 100,
    discretionaryPercent: Math.round(discretionaryPercent * 10) / 10,
    topCategories,
    comparison,
    healthCheck:
      discretionaryPercent > 40
        ? "Discretionary spending is above 40% - consider reviewing"
        : "Spending balance looks healthy",
  };
}

export async function handleGetBudgetStatus(params: BudgetStatusParams, userId: string) {
  const supabase = await createClient();
  const { month, category } = params;

  const now = new Date();
  const targetMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [year, monthNum] = targetMonth.split("-").map(Number);
  const startDate = new Date(year, monthNum - 1, 1).toISOString().split("T")[0];
  const endDate = new Date(year, monthNum, 0).toISOString().split("T")[0];
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const monthProgress = dayOfMonth / daysInMonth;

  let budgetQuery = supabase.from("budgets").select("id, category, amount").eq("user_id", userId).eq("budget_type", "monthly");
  if (category) budgetQuery = budgetQuery.eq("category", category);

  const { data: budgetsRaw } = await budgetQuery;
  const budgets = budgetsRaw as BudgetRow[] | null;

  let spendingQuery = supabase
    .from("transactions")
    .select("category, amount")
    .eq("user_id", userId)
    .gte("date", startDate)
    .lte("date", endDate)
    .gt("amount", 0)
    .in("classification", ["Essential", "Discretionary"]);

  if (category) spendingQuery = spendingQuery.eq("category", category);

  const { data: transactionsRaw } = await spendingQuery;
  const transactions = transactionsRaw as Array<{ category: string | null; amount: number }> | null;

  const spending: Record<string, number> = {};
  transactions?.forEach((t) => {
    const cat = t.category || "Uncategorized";
    spending[cat] = (spending[cat] || 0) + t.amount;
  });

  const results = (budgets || []).map((b) => {
    const actual = spending[b.category] || 0;
    const paceTarget = b.amount * monthProgress;
    const percentUsed = (actual / b.amount) * 100;
    const onTrack = actual <= paceTarget;

    return {
      category: b.category,
      budget: b.amount,
      actual: Math.round(actual * 100) / 100,
      remaining: Math.round((b.amount - actual) * 100) / 100,
      percentUsed: Math.round(percentUsed),
      paceTarget: Math.round(paceTarget * 100) / 100,
      onTrack,
      status: onTrack ? "on_track" : percentUsed > 100 ? "over_budget" : "at_risk",
    };
  });

  return {
    month: targetMonth,
    monthProgress: Math.round(monthProgress * 100),
    budgetStatus: results,
    summary:
      results.length === 0
        ? "No budgets set. Would you like me to help you set some?"
        : `${results.filter((r) => r.onTrack).length}/${results.length} categories on track`,
  };
}

export async function handleGetSubscriptions(params: SubscriptionsParams, userId: string) {
  const supabase = await createClient();
  const { minOccurrences } = params;

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { data: transactionsRaw } = await supabase
    .from("transactions")
    .select("merchant_normalised, amount, category, date")
    .eq("user_id", userId)
    .gte("date", sixMonthsAgo.toISOString().split("T")[0])
    .gt("amount", 0)
    .in("category", ["Subscriptions - Media", "Subscriptions - Software", "Subscriptions - Food"]);

  const transactions = transactionsRaw as SubscriptionRow[] | null;

  const subscriptions: Record<
    string,
    { occurrences: number; totalSpent: number; category: string; lastDate: string }
  > = {};

  transactions?.forEach((t) => {
    const key = t.merchant_normalised || "Unknown";
    if (!subscriptions[key]) {
      subscriptions[key] = { occurrences: 0, totalSpent: 0, category: t.category || "Unknown", lastDate: t.date };
    }
    subscriptions[key].occurrences++;
    subscriptions[key].totalSpent += t.amount;
    if (t.date > subscriptions[key].lastDate) subscriptions[key].lastDate = t.date;
  });

  const recurring = Object.entries(subscriptions)
    .filter(([_, data]) => data.occurrences >= (minOccurrences || 2))
    .map(([name, data]) => ({
      name,
      ...data,
      avgAmount: Math.round((data.totalSpent / data.occurrences) * 100) / 100,
      estimatedMonthly: Math.round((data.totalSpent / 6) * 100) / 100,
      estimatedAnnual: Math.round((data.totalSpent / 6) * 12 * 100) / 100,
    }))
    .sort((a, b) => b.estimatedMonthly - a.estimatedMonthly);

  const totalMonthly = recurring.reduce((sum, s) => sum + s.estimatedMonthly, 0);

  return {
    subscriptions: recurring,
    count: recurring.length,
    totalMonthly: Math.round(totalMonthly * 100) / 100,
    totalAnnual: Math.round(totalMonthly * 12 * 100) / 100,
    summary: `Found ${recurring.length} recurring subscriptions costing ~$${totalMonthly.toFixed(2)}/month`,
  };
}

export async function handleCategorizeTransaction(params: CategorizeParams, userId: string) {
  const supabase = await createClient();
  const { transactionId, category, notes } = params;

  const { data: categoryDataRaw } = await supabase.from("categories").select("classification").eq("name", category).single();
  const categoryData = categoryDataRaw as CategoryRow | null;

  if (!categoryData) {
    return { error: `Invalid category: ${category}. Please use a valid category name.` };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("transactions")
    .update({
      category,
      classification: categoryData.classification,
      needs_review: false,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", transactionId)
    .eq("user_id", userId);

  if (error) {
    return { error: error.message };
  }

  return {
    success: true,
    message: `Transaction categorized as "${category}" (${categoryData.classification})`,
  };
}

export async function handleAddMerchantMapping(params: MerchantMappingParams, userId: string) {
  const supabase = await createClient();
  const { merchantPattern, category, notes } = params;

  const { data: categoryDataRaw } = await supabase.from("categories").select("classification").eq("name", category).single();
  const categoryData = categoryDataRaw as CategoryRow | null;

  if (!categoryData) {
    return { error: `Invalid category: ${category}` };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("merchant_mappings").upsert(
    {
      user_id: userId,
      merchant_pattern: merchantPattern.toLowerCase(),
      category,
      classification: categoryData.classification,
      notes,
    },
    { onConflict: "user_id,merchant_pattern" }
  );

  if (error) {
    return { error: error.message };
  }

  return {
    success: true,
    message: `Learned: "${merchantPattern}" → ${category}. Future transactions will be auto-categorized.`,
  };
}

export async function handleSetBudget(params: SetBudgetParams, userId: string) {
  const supabase = await createClient();
  const { category, amount, notes } = params;

  const { data: categoryDataRaw } = await supabase.from("categories").select("name").eq("name", category).single();
  const categoryData = categoryDataRaw as CategoryNameRow | null;

  if (!categoryData) {
    return { error: `Invalid category: ${category}` };
  }

  const now = new Date();
  const effectiveFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("budgets").upsert(
    {
      user_id: userId,
      category,
      budget_type: "monthly",
      amount,
      effective_from: effectiveFrom,
      notes,
    },
    { onConflict: "user_id,category,budget_type,effective_from" }
  );

  if (error) {
    return { error: error.message };
  }

  return {
    success: true,
    message: `Budget set: $${amount}/month for ${category}`,
  };
}
