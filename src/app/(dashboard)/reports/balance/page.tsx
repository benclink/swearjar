import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { TrendingDown, TrendingUp, Target, ArrowUpIcon, ArrowDownIcon } from "lucide-react";
import Link from "next/link";
import { BalanceTrendChart } from "@/components/charts/balance-trend-chart";

interface MonthlyData {
  month: string;
  year: number;
  monthNum: number;
  essential: number;
  discretionary: number;
  total: number;
  ratio: number;
}

interface TransactionRow {
  amount: number;
  classification: string | null;
}

export default async function BalanceReportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Get last 12 months of data
  const now = new Date();
  const months: MonthlyData[] = [];

  for (let i = 11; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const startOfMonth = date.toISOString().split("T")[0];
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split("T")[0];

    const { data: transactionsRaw } = await supabase
      .from("transactions")
      .select("amount, classification")
      .eq("user_id", user.id)
      .gte("date", startOfMonth)
      .lte("date", endOfMonth)
      .gt("amount", 0)
      .in("classification", ["Essential", "Discretionary"]);

    const transactions = transactionsRaw as TransactionRow[] | null;
    const essential = transactions?.filter(t => t.classification === "Essential").reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    const discretionary = transactions?.filter(t => t.classification === "Discretionary").reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    const total = essential + discretionary;

    months.push({
      month: date.toLocaleDateString("en-AU", { month: "short" }),
      year: date.getFullYear(),
      monthNum: date.getMonth() + 1,
      essential,
      discretionary,
      total,
      ratio: total > 0 ? (essential / total) * 100 : 0,
    });
  }

  // Calculate averages and trends
  const totalEssential = months.reduce((sum, m) => sum + m.essential, 0);
  const totalDiscretionary = months.reduce((sum, m) => sum + m.discretionary, 0);
  const grandTotal = totalEssential + totalDiscretionary;
  const avgRatio = grandTotal > 0 ? (totalEssential / grandTotal) * 100 : 0;
  const avgMonthlyTotal = grandTotal / 12;

  // Current month vs previous month
  const currentMonth = months[months.length - 1];
  const previousMonth = months[months.length - 2];

  const essentialChange = previousMonth.essential > 0
    ? ((currentMonth.essential - previousMonth.essential) / previousMonth.essential) * 100
    : 0;
  const discretionaryChange = previousMonth.discretionary > 0
    ? ((currentMonth.discretionary - previousMonth.discretionary) / previousMonth.discretionary) * 100
    : 0;
  const ratioChange = currentMonth.ratio - previousMonth.ratio;

  // Best and worst months
  const sortedByRatio = [...months].filter(m => m.total > 0).sort((a, b) => b.ratio - a.ratio);
  const bestMonth = sortedByRatio[0];
  const worstMonth = sortedByRatio[sortedByRatio.length - 1];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Link href="/reports" className="hover:underline">Reports</Link>
          <span>/</span>
          <span>Essential vs Discretionary</span>
        </div>
        <h1 className="text-3xl font-bold">Spending Balance Analysis</h1>
        <p className="text-muted-foreground">Analyze your essential vs discretionary spending trends over time</p>
      </div>

      {/* Current Month Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Essential Ratio</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentMonth.ratio.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {ratioChange > 0 ? (
                <ArrowUpIcon className="h-3 w-3 text-green-500" />
              ) : (
                <ArrowDownIcon className="h-3 w-3 text-destructive" />
              )}
              {Math.abs(ratioChange).toFixed(1)}pp from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Essential This Month</CardTitle>
            <TrendingDown className="h-4 w-4 text-essential" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(currentMonth.essential)}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {essentialChange < 0 ? (
                <ArrowDownIcon className="h-3 w-3 text-green-500" />
              ) : (
                <ArrowUpIcon className="h-3 w-3 text-destructive" />
              )}
              {Math.abs(essentialChange).toFixed(1)}% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Discretionary This Month</CardTitle>
            <TrendingUp className="h-4 w-4 text-discretionary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(currentMonth.discretionary)}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {discretionaryChange < 0 ? (
                <ArrowDownIcon className="h-3 w-3 text-green-500" />
              ) : (
                <ArrowUpIcon className="h-3 w-3 text-destructive" />
              )}
              {Math.abs(discretionaryChange).toFixed(1)}% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">12-Month Average</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgRatio.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Essential ratio average
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>12-Month Trend</CardTitle>
          <CardDescription>Essential vs Discretionary spending over time</CardDescription>
        </CardHeader>
        <CardContent>
          <BalanceTrendChart data={months} />
        </CardContent>
      </Card>

      {/* Monthly Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Breakdown</CardTitle>
            <CardDescription>Detailed view of each month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[...months].reverse().map((m) => (
                <Link
                  key={`${m.year}-${m.monthNum}`}
                  href={`/reports/monthly?month=${m.monthNum}&year=${m.year}`}
                  className="flex items-center justify-between py-2 border-b last:border-0 hover:bg-muted/50 -mx-2 px-2 rounded"
                >
                  <div>
                    <p className="font-medium">{m.month} {m.year}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(m.total)} total
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{m.ratio.toFixed(0)}% Essential</p>
                    <div className="flex gap-2 text-sm">
                      <span className="text-green-600">{formatCurrency(m.essential)}</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-yellow-600">{formatCurrency(m.discretionary)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Insights</CardTitle>
            <CardDescription>Key observations about your spending</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="font-medium text-green-600">Best Balance</p>
                {bestMonth ? (
                  <p className="text-sm text-muted-foreground">
                    {bestMonth.month} {bestMonth.year} - {bestMonth.ratio.toFixed(0)}% essential spending
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">No data available</p>
                )}
              </div>

              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="font-medium text-yellow-600">Most Discretionary</p>
                {worstMonth ? (
                  <p className="text-sm text-muted-foreground">
                    {worstMonth.month} {worstMonth.year} - {(100 - worstMonth.ratio).toFixed(0)}% discretionary spending
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">No data available</p>
                )}
              </div>

              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="font-medium">Average Monthly Spend</p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(avgMonthlyTotal)} per month over the last 12 months
                </p>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="font-medium">12-Month Totals</p>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Essential: {formatCurrency(totalEssential)}</p>
                  <p>Discretionary: {formatCurrency(totalDiscretionary)}</p>
                  <p className="font-medium text-foreground">Total: {formatCurrency(grandTotal)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
