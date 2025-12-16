import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { SpendingOverview } from "@/components/charts/spending-overview";
import { CategoryBreakdown } from "@/components/charts/category-breakdown";
import { IncomeExpenseChart } from "@/components/charts/income-expense-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";

interface SpendingRow {
  amount: number;
  classification: string | null;
  category: string | null;
}

interface RecentTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string | null;
  classification: string | null;
  merchant_normalised: string | null;
}

async function getDashboardData(userId: string) {
  const supabase = await createClient();

  // Get current month's date range
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Get last month's date range
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  // Fetch current month spending
  const { data: currentMonthRaw } = await supabase
    .from("transactions")
    .select("amount, classification, category")
    .eq("user_id", userId)
    .gte("date", startOfMonth.toISOString().split("T")[0])
    .lte("date", endOfMonth.toISOString().split("T")[0])
    .gt("amount", 0)
    .in("classification", ["Essential", "Discretionary"]);

  const currentMonthData = currentMonthRaw as SpendingRow[] | null;

  // Fetch last month spending for comparison
  const { data: lastMonthRaw } = await supabase
    .from("transactions")
    .select("amount, classification")
    .eq("user_id", userId)
    .gte("date", startOfLastMonth.toISOString().split("T")[0])
    .lte("date", endOfLastMonth.toISOString().split("T")[0])
    .gt("amount", 0)
    .in("classification", ["Essential", "Discretionary"]);

  const lastMonthData = lastMonthRaw as Array<{ amount: number; classification: string | null }> | null;

  // Fetch current month income (negative amounts are income)
  const { data: currentIncomeRaw } = await supabase
    .from("transactions")
    .select("amount")
    .eq("user_id", userId)
    .gte("date", startOfMonth.toISOString().split("T")[0])
    .lte("date", endOfMonth.toISOString().split("T")[0])
    .lt("amount", 0);

  const currentIncomeData = currentIncomeRaw as Array<{ amount: number }> | null;

  // Fetch last month income for comparison
  const { data: lastIncomeRaw } = await supabase
    .from("transactions")
    .select("amount")
    .eq("user_id", userId)
    .gte("date", startOfLastMonth.toISOString().split("T")[0])
    .lte("date", endOfLastMonth.toISOString().split("T")[0])
    .lt("amount", 0);

  const lastIncomeData = lastIncomeRaw as Array<{ amount: number }> | null;

  // Fetch transactions needing review
  const { count: needsReviewCount } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("needs_review", true);

  // Fetch recent transactions
  const { data: recentRaw } = await supabase
    .from("transactions")
    .select("id, date, description, amount, category, classification, merchant_normalised")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .order("time", { ascending: false })
    .limit(10);

  const recentTransactions = recentRaw as RecentTransaction[] | null;

  // Calculate totals
  const currentMonth = {
    essential: currentMonthData?.filter(t => t.classification === "Essential").reduce((sum, t) => sum + Number(t.amount), 0) || 0,
    discretionary: currentMonthData?.filter(t => t.classification === "Discretionary").reduce((sum, t) => sum + Number(t.amount), 0) || 0,
    total: 0,
    income: currentIncomeData?.reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0) || 0,
    netSavings: 0,
  };
  currentMonth.total = currentMonth.essential + currentMonth.discretionary;
  currentMonth.netSavings = currentMonth.income - currentMonth.total;

  const lastMonth = {
    essential: lastMonthData?.filter(t => t.classification === "Essential").reduce((sum, t) => sum + Number(t.amount), 0) || 0,
    discretionary: lastMonthData?.filter(t => t.classification === "Discretionary").reduce((sum, t) => sum + Number(t.amount), 0) || 0,
    total: 0,
    income: lastIncomeData?.reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0) || 0,
  };
  lastMonth.total = lastMonth.essential + lastMonth.discretionary;

  // Calculate change percentages
  const change = {
    total: lastMonth.total > 0 ? ((currentMonth.total - lastMonth.total) / lastMonth.total) * 100 : 0,
    essential: lastMonth.essential > 0 ? ((currentMonth.essential - lastMonth.essential) / lastMonth.essential) * 100 : 0,
    discretionary: lastMonth.discretionary > 0 ? ((currentMonth.discretionary - lastMonth.discretionary) / lastMonth.discretionary) * 100 : 0,
    income: lastMonth.income > 0 ? ((currentMonth.income - lastMonth.income) / lastMonth.income) * 100 : 0,
  };

  // Group by category for chart
  const byCategory = currentMonthData?.reduce((acc, t) => {
    const cat = t.category || "Uncategorized";
    if (!acc[cat]) {
      acc[cat] = { amount: 0, classification: t.classification || "Discretionary" };
    }
    acc[cat].amount += Number(t.amount);
    return acc;
  }, {} as Record<string, { amount: number; classification: string }>) || {};

  return {
    currentMonth,
    lastMonth,
    change,
    byCategory,
    needsReviewCount: needsReviewCount || 0,
    recentTransactions: recentTransactions || [],
  };
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const data = await getDashboardData(user.id);
  const now = new Date();
  const monthName = now.toLocaleDateString("en-AU", { month: "long", year: "numeric" });

  const savingsRate = data.currentMonth.income > 0
    ? ((data.currentMonth.netSavings / data.currentMonth.income) * 100).toFixed(0)
    : null;

  return (
    <div className="p-8 space-y-8 max-w-6xl">
      {/* Header */}
      <header>
        <h1 className="text-lg font-medium">{monthName}</h1>
      </header>

      {/* Key Metrics */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Income</p>
          <p className="text-2xl font-medium tabular-nums">{formatCurrency(data.currentMonth.income)}</p>
          {data.change.income !== 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {data.change.income > 0 ? "+" : ""}{data.change.income.toFixed(0)}% vs last month
            </p>
          )}
        </div>

        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Spending</p>
          <p className="text-2xl font-medium tabular-nums">{formatCurrency(data.currentMonth.total)}</p>
          {data.change.total !== 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {data.change.total > 0 ? "+" : ""}{data.change.total.toFixed(0)}% vs last month
            </p>
          )}
        </div>

        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Net</p>
          <p className={`text-2xl font-medium tabular-nums ${data.currentMonth.netSavings >= 0 ? "text-essential" : "text-destructive"}`}>
            {data.currentMonth.netSavings >= 0 ? "+" : ""}{formatCurrency(data.currentMonth.netSavings)}
          </p>
          {savingsRate && (
            <p className="text-xs text-muted-foreground mt-1">
              {data.currentMonth.netSavings >= 0 ? `${savingsRate}% saved` : `${Math.abs(Number(savingsRate))}% overspent`}
            </p>
          )}
        </div>

        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Review</p>
          <p className="text-2xl font-medium tabular-nums">{data.needsReviewCount}</p>
          <p className="text-xs text-muted-foreground mt-1">transactions</p>
        </div>
      </section>

      {/* Spending Breakdown */}
      <section className="grid grid-cols-2 gap-6 pt-2">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Essential</p>
          <p className="text-xl font-medium tabular-nums">{formatCurrency(data.currentMonth.essential)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {data.currentMonth.income > 0
              ? `${((data.currentMonth.essential / data.currentMonth.income) * 100).toFixed(0)}% of income`
              : data.currentMonth.total > 0
              ? `${((data.currentMonth.essential / data.currentMonth.total) * 100).toFixed(0)}% of spending`
              : "—"}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Discretionary</p>
          <p className="text-xl font-medium tabular-nums">{formatCurrency(data.currentMonth.discretionary)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {data.currentMonth.income > 0
              ? `${((data.currentMonth.discretionary / data.currentMonth.income) * 100).toFixed(0)}% of income`
              : data.currentMonth.total > 0
              ? `${((data.currentMonth.discretionary / data.currentMonth.total) * 100).toFixed(0)}% of spending`
              : "—"}
          </p>
        </div>
      </section>

      {/* Charts */}
      <section className="grid md:grid-cols-3 gap-6 pt-4">
        <Card>
          <CardHeader>
            <CardTitle>Cash Flow</CardTitle>
          </CardHeader>
          <CardContent>
            <IncomeExpenseChart
              income={data.currentMonth.income}
              expenses={data.currentMonth.total}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <SpendingOverview
              essential={data.currentMonth.essential}
              discretionary={data.currentMonth.discretionary}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryBreakdown data={data.byCategory} />
          </CardContent>
        </Card>
      </section>

      {/* Recent Activity */}
      <section className="pt-4">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentTransactions transactions={data.recentTransactions} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
