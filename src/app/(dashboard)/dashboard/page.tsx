import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { SpendingOverview } from "@/components/charts/spending-overview";
import { CategoryBreakdown } from "@/components/charts/category-breakdown";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { ArrowDownIcon, ArrowUpIcon, DollarSign, TrendingDown, TrendingUp, AlertCircle } from "lucide-react";

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
  };
  currentMonth.total = currentMonth.essential + currentMonth.discretionary;

  const lastMonth = {
    essential: lastMonthData?.filter(t => t.classification === "Essential").reduce((sum, t) => sum + Number(t.amount), 0) || 0,
    discretionary: lastMonthData?.filter(t => t.classification === "Discretionary").reduce((sum, t) => sum + Number(t.amount), 0) || 0,
    total: 0,
  };
  lastMonth.total = lastMonth.essential + lastMonth.discretionary;

  // Calculate change percentages
  const change = {
    total: lastMonth.total > 0 ? ((currentMonth.total - lastMonth.total) / lastMonth.total) * 100 : 0,
    essential: lastMonth.essential > 0 ? ((currentMonth.essential - lastMonth.essential) / lastMonth.essential) * 100 : 0,
    discretionary: lastMonth.discretionary > 0 ? ((currentMonth.discretionary - lastMonth.discretionary) / lastMonth.discretionary) * 100 : 0,
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
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Your financial overview for {monthName}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spending</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.currentMonth.total)}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {data.change.total > 0 ? (
                <ArrowUpIcon className="h-3 w-3 text-destructive" />
              ) : (
                <ArrowDownIcon className="h-3 w-3 text-green-500" />
              )}
              {Math.abs(data.change.total).toFixed(1)}% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Essential</CardTitle>
            <TrendingDown className="h-4 w-4 text-essential" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.currentMonth.essential)}</div>
            <p className="text-xs text-muted-foreground">
              {data.currentMonth.total > 0
                ? ((data.currentMonth.essential / data.currentMonth.total) * 100).toFixed(0)
                : 0}% of total spending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Discretionary</CardTitle>
            <TrendingUp className="h-4 w-4 text-discretionary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.currentMonth.discretionary)}</div>
            <p className="text-xs text-muted-foreground">
              {data.currentMonth.total > 0
                ? ((data.currentMonth.discretionary / data.currentMonth.total) * 100).toFixed(0)
                : 0}% of total spending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Needs Review</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.needsReviewCount}</div>
            <p className="text-xs text-muted-foreground">
              Transactions to categorize
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Spending Overview</CardTitle>
            <CardDescription>Essential vs Discretionary spending</CardDescription>
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
            <CardTitle>Category Breakdown</CardTitle>
            <CardDescription>Top spending categories this month</CardDescription>
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
