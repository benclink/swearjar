// Transaction query tools
import { createClient } from "@/lib/supabase/server";

interface TransactionFilters {
  start_date?: string;
  end_date?: string;
  category?: string;
  classification?: string;
  merchant?: string;
  min_amount?: number;
  max_amount?: number;
  limit?: number;
}

interface TransactionRow {
  id: string;
  date: string;
  time: string | null;
  description: string;
  amount: number;
  category: string | null;
  classification: string | null;
  merchant_normalised: string | null;
  source: string;
  needs_review: boolean;
}

export async function getTransactions(userId: string, filters: TransactionFilters) {
  const supabase = await createClient();

  let query = supabase
    .from("transactions")
    .select("id, date, time, description, amount, category, classification, merchant_normalised, source, needs_review")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .order("time", { ascending: false });

  if (filters.start_date) {
    query = query.gte("date", filters.start_date);
  }
  if (filters.end_date) {
    query = query.lte("date", filters.end_date);
  }
  if (filters.category) {
    query = query.eq("category", filters.category);
  }
  if (filters.classification) {
    query = query.eq("classification", filters.classification);
  }
  if (filters.merchant) {
    query = query.ilike("merchant_normalised", `%${filters.merchant}%`);
  }
  if (filters.min_amount !== undefined) {
    query = query.gte("amount", filters.min_amount);
  }
  if (filters.max_amount !== undefined) {
    query = query.lte("amount", filters.max_amount);
  }

  query = query.limit(filters.limit || 50);

  const { data, error } = await query;

  if (error) {
    return { error: error.message };
  }

  const transactions = data as TransactionRow[] | null;
  const total = transactions?.reduce((sum, t) => sum + (t.amount > 0 ? t.amount : 0), 0) || 0;
  const income = transactions?.reduce((sum, t) => sum + (t.amount < 0 ? Math.abs(t.amount) : 0), 0) || 0;

  return {
    transactions: transactions || [],
    count: transactions?.length || 0,
    total_spending: Math.round(total * 100) / 100,
    total_income: Math.round(income * 100) / 100,
  };
}

interface SpendingSummaryParams {
  start_date: string;
  end_date: string;
  group_by: "category" | "classification" | "merchant";
}

interface SpendingRow {
  amount: number;
  category: string | null;
  classification: string | null;
  merchant_normalised: string | null;
}

export async function getSpendingSummary(userId: string, params: SpendingSummaryParams) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("transactions")
    .select("amount, category, classification, merchant_normalised")
    .eq("user_id", userId)
    .gte("date", params.start_date)
    .lte("date", params.end_date)
    .gt("amount", 0); // Only spending, not income

  if (error) {
    return { error: error.message };
  }

  const transactions = data as SpendingRow[] | null;

  // Aggregate by the requested field
  const summary: Record<string, { total: number; count: number }> = {};
  let grandTotal = 0;

  transactions?.forEach((t) => {
    let key: string;
    switch (params.group_by) {
      case "category":
        key = t.category || "Uncategorized";
        break;
      case "classification":
        key = t.classification || "Unknown";
        break;
      case "merchant":
        key = t.merchant_normalised || "Unknown";
        break;
    }

    if (!summary[key]) {
      summary[key] = { total: 0, count: 0 };
    }
    summary[key].total += t.amount;
    summary[key].count++;
    grandTotal += t.amount;
  });

  // Convert to array and sort by total
  const breakdown = Object.entries(summary)
    .map(([name, data]) => ({
      name,
      total: Math.round(data.total * 100) / 100,
      count: data.count,
      percentage: grandTotal > 0 ? Math.round((data.total / grandTotal) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    period: {
      start: params.start_date,
      end: params.end_date,
    },
    group_by: params.group_by,
    total: Math.round(grandTotal * 100) / 100,
    breakdown,
  };
}

export async function getRecentActivity(userId: string, days: number = 30) {
  const supabase = await createClient();

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data: transactionsRaw, error } = await supabase
    .from("transactions")
    .select("date, amount, category, classification, merchant_normalised")
    .eq("user_id", userId)
    .gte("date", startDate.toISOString().split("T")[0])
    .order("date", { ascending: false });

  if (error) {
    return { error: error.message };
  }

  const transactions = transactionsRaw as Array<{
    date: string;
    amount: number;
    category: string | null;
    classification: string | null;
    merchant_normalised: string | null;
  }> | null;

  // Daily spending totals
  const dailySpending: Record<string, number> = {};
  let totalSpending = 0;
  let essentialTotal = 0;
  let discretionaryTotal = 0;

  transactions?.forEach((t) => {
    if (t.amount > 0) {
      dailySpending[t.date] = (dailySpending[t.date] || 0) + t.amount;
      totalSpending += t.amount;

      if (t.classification === "Essential") {
        essentialTotal += t.amount;
      } else if (t.classification === "Discretionary") {
        discretionaryTotal += t.amount;
      }
    }
  });

  // Top merchants
  const merchantTotals: Record<string, number> = {};
  transactions?.forEach((t) => {
    if (t.amount > 0 && t.merchant_normalised) {
      merchantTotals[t.merchant_normalised] = (merchantTotals[t.merchant_normalised] || 0) + t.amount;
    }
  });

  const topMerchants = Object.entries(merchantTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, total]) => ({ name, total: Math.round(total * 100) / 100 }));

  const daysWithData = Object.keys(dailySpending).length;
  const avgDaily = daysWithData > 0 ? totalSpending / daysWithData : 0;

  return {
    period_days: days,
    total_spending: Math.round(totalSpending * 100) / 100,
    essential: Math.round(essentialTotal * 100) / 100,
    discretionary: Math.round(discretionaryTotal * 100) / 100,
    discretionary_pct:
      totalSpending > 0 ? Math.round((discretionaryTotal / totalSpending) * 1000) / 10 : 0,
    avg_daily: Math.round(avgDaily * 100) / 100,
    transaction_count: transactions?.length || 0,
    top_merchants: topMerchants,
  };
}
