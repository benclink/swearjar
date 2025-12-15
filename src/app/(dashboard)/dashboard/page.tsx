import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { SpendingOverview } from "@/components/charts/spending-overview";
import { CategoryBreakdown } from "@/components/charts/category-breakdown";
import { IncomeExpenseChart } from "@/components/charts/income-expense-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { ArrowDownIcon, ArrowUpIcon, DollarSign, TrendingDown, TrendingUp, AlertCircle, Wallet, PiggyBank } from "lucide-react";

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

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">{monthName}</p>
      </div>

      {/* Summary Cards - Row 1: Income & Savings */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Income</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums text-green-600">{formatCurrency(data.currentMonth.income)}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              {data.change.income > 0 ? (
                <ArrowUpIcon className="h-3 w-3 text-green-500" />
              ) : data.change.income < 0 ? (
                <ArrowDownIcon className="h-3 w-3 text-destructive" />
              ) : null}
              {data.change.income !== 0 && `${Math.abs(data.change.income).toFixed(1)}% from last month`}
              {data.change.income === 0 && "No change from last month"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Spending</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">{formatCurrency(data.currentMonth.total)}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              {data.change.total > 0 ? (
                <ArrowUpIcon className="h-3 w-3 text-destructive" />
              ) : (
                <ArrowDownIcon className="h-3 w-3 text-green-500" />
              )}
              {Math.abs(data.change.total).toFixed(1)}% from last month
            </p>
          </CardContent>
        </Card>

        <Card className={data.currentMonth.netSavings >= 0 ? "border-green-500/30 bg-green-500/[0.02]" : "border-red-500/30 bg-red-500/[0.02]"}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Savings</CardTitle>
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${data.currentMonth.netSavings >= 0 ? "bg-green-500/10" : "bg-red-500/10"}`}>
              <PiggyBank className={`h-4 w-4 ${data.currentMonth.netSavings >= 0 ? "text-green-600" : "text-destructive"}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-semibold tabular-nums ${data.currentMonth.netSavings >= 0 ? "text-green-600" : "text-destructive"}`}>
              {data.currentMonth.netSavings >= 0 ? "+" : ""}{formatCurrency(data.currentMonth.netSavings)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.currentMonth.income > 0
                ? data.currentMonth.netSavings >= 0
                  ? `Saving ${((data.currentMonth.netSavings / data.currentMonth.income) * 100).toFixed(0)}% of income`
                  : `Overspent by ${((Math.abs(data.currentMonth.netSavings) / data.currentMonth.income) * 100).toFixed(0)}% of income`
                : "No income recorded"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Summary Cards - Row 2: Spending Breakdown */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Essential</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-essential/10 flex items-center justify-center">
              <TrendingDown className="h-4 w-4 text-essential" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">{formatCurrency(data.currentMonth.essential)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.currentMonth.income > 0
                ? `${((data.currentMonth.essential / data.currentMonth.income) * 100).toFixed(0)}% of income`
                : data.currentMonth.total > 0
                ? `${((data.currentMonth.essential / data.currentMonth.total) * 100).toFixed(0)}% of spending`
                : "0%"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Discretionary</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-discretionary/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-discretionary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">{formatCurrency(data.currentMonth.discretionary)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.currentMonth.income > 0
                ? `${((data.currentMonth.discretionary / data.currentMonth.income) * 100).toFixed(0)}% of income`
                : data.currentMonth.total > 0
                ? `${((data.currentMonth.discretionary / data.currentMonth.total) * 100).toFixed(0)}% of spending`
                : "0%"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Needs Review</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <AlertCircle className="h-4 w-4 text-orange-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">{data.needsReviewCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Transactions to categorize
            </p>
          </CardContent>
        </Card>

        {/* Spending Rate Progress */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Spending Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {data.currentMonth.income > 0
                ? `${((data.currentMonth.total / data.currentMonth.income) * 100).toFixed(0)}%`
                : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              of income spent this month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Income vs Expenses</CardTitle>
            <CardDescription>Monthly cash flow overview</CardDescription>
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
            <CardTitle>Spending Breakdown</CardTitle>
            <CardDescription>Essential vs Discretionary</CardDescription>
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
            <CardTitle>By Category</CardTitle>
            <CardDescription>Top spending categories</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryBreakdown data={data.byCategory} />
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>Your latest financial activity</CardDescription>
        </CardHeader>
        <CardContent>
          <RecentTransactions transactions={data.recentTransactions} />
        </CardContent>
      </Card>
    </div>
  );
}
