"use server";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
type Budget = Database["public"]["Tables"]["budgets"]["Row"];

export async function exportTransactionsCSV() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const { data: transactionsRaw, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .order("time", { ascending: false });

  if (error) {
    return { error: error.message };
  }

  const transactions = transactionsRaw as Transaction[];

  // Generate CSV
  const headers = [
    "Date",
    "Time",
    "Description",
    "Merchant",
    "Amount",
    "Category",
    "Classification",
    "Source",
    "Account",
    "Is Transfer",
    "Notes",
  ];

  const rows = transactions.map((t) => [
    t.date,
    t.time || "",
    `"${(t.description || "").replace(/"/g, '""')}"`,
    `"${(t.merchant_normalised || "").replace(/"/g, '""')}"`,
    t.amount.toString(),
    t.category || "",
    t.classification || "",
    t.source || "",
    t.source_account || "",
    t.is_transfer ? "Yes" : "No",
    `"${(t.notes || "").replace(/"/g, '""')}"`,
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

  return { csv, filename: `transactions-${new Date().toISOString().split("T")[0]}.csv` };
}

export async function exportBudgetReport() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // Get budgets
  const { data: budgetsRaw } = await supabase
    .from("budgets")
    .select("*")
    .eq("user_id", user.id)
    .order("category");

  const budgets = budgetsRaw as Budget[] | null;

  // Get current month spending
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  const { data: spendingRaw } = await supabase
    .from("transactions")
    .select("category, amount")
    .eq("user_id", user.id)
    .gte("date", startOfMonth)
    .lte("date", endOfMonth)
    .gt("amount", 0)
    .in("classification", ["Essential", "Discretionary"]);

  const spending = spendingRaw as Array<{ category: string | null; amount: number }> | null;

  // Aggregate spending
  const spendingByCategory: Record<string, number> = {};
  spending?.forEach((t) => {
    const cat = t.category || "Uncategorized";
    spendingByCategory[cat] = (spendingByCategory[cat] || 0) + t.amount;
  });

  // Generate CSV
  const headers = [
    "Category",
    "Budget Type",
    "Budget Amount",
    "Actual Spending",
    "Remaining",
    "Percent Used",
    "Status",
  ];

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthProgress = now.getDate() / daysInMonth;

  const rows = budgets?.map((b) => {
    const actual = spendingByCategory[b.category] || 0;
    const remaining = b.amount - actual;
    const percentUsed = Math.round((actual / b.amount) * 100);
    const paceTarget = b.amount * monthProgress;
    const status = actual > b.amount ? "Over Budget" : actual <= paceTarget ? "On Track" : "At Risk";

    return [
      b.category,
      b.budget_type,
      b.amount.toFixed(2),
      actual.toFixed(2),
      remaining.toFixed(2),
      `${percentUsed}%`,
      status,
    ];
  }) || [];

  const monthName = now.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
  const csv = [
    `Budget Report - ${monthName}`,
    "",
    headers.join(","),
    ...rows.map((r) => r.join(",")),
  ].join("\n");

  return { csv, filename: `budget-report-${now.toISOString().split("T")[0]}.csv` };
}
