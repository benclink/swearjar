import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp, DollarSign } from "lucide-react";
import Link from "next/link";
import { SpendingOverview } from "@/components/charts/spending-overview";
import { CategoryBreakdown } from "@/components/charts/category-breakdown";

interface PageProps {
  searchParams: Promise<{
    month?: string;
    year?: string;
  }>;
}

interface Transaction {
  amount: number;
  classification: string | null;
  category: string | null;
  date: string;
  description: string;
  merchant_normalised: string | null;
}

export default async function MonthlyReportPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Parse month/year from params or use current
  const now = new Date();
  const year = parseInt(params.year || String(now.getFullYear()));
  const month = parseInt(params.month || String(now.getMonth() + 1));

  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0);
  const startDate = startOfMonth.toISOString().split("T")[0];
  const endDate = endOfMonth.toISOString().split("T")[0];

  // Navigation dates
  const prevMonth = new Date(year, month - 2, 1);
  const nextMonth = new Date(year, month, 1);
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  // Fetch transactions for this month
  const { data: transactionsRaw } = await supabase
    .from("transactions")
    .select("amount, classification, category, date, description, merchant_normalised")
    .eq("user_id", user.id)
    .gte("date", startDate)
    .lte("date", endDate)
    .gt("amount", 0)
    .in("classification", ["Essential", "Discretionary"]);

  const transactions = transactionsRaw as Transaction[] | null;

  // Calculate totals
  const essential = transactions?.filter(t => t.classification === "Essential").reduce((sum, t) => sum + Number(t.amount), 0) || 0;
  const discretionary = transactions?.filter(t => t.classification === "Discretionary").reduce((sum, t) => sum + Number(t.amount), 0) || 0;
  const total = essential + discretionary;

  // Group by category
  const byCategory = transactions?.reduce((acc, t) => {
    const cat = t.category || "Uncategorized";
    if (!acc[cat]) {
      acc[cat] = { amount: 0, classification: t.classification || "Discretionary", transactions: [] as Transaction[] };
    }
    acc[cat].amount += Number(t.amount);
    acc[cat].transactions.push(t);
    return acc;
  }, {} as Record<string, { amount: number; classification: string; transactions: Transaction[] }>) || {};

  // Top merchants
  const byMerchant = transactions?.reduce((acc, t) => {
    const merchant = t.merchant_normalised || t.description;
    if (!acc[merchant]) {
      acc[merchant] = 0;
    }
    acc[merchant] += Number(t.amount);
    return acc;
  }, {} as Record<string, number>) || {};

  const topMerchants = Object.entries(byMerchant)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Category breakdown sorted by amount
  const categoryList = Object.entries(byCategory)
    .map(([name, data]) => ({
      name,
      amount: data.amount,
      classification: data.classification,
      count: data.transactions.length,
    }))
    .sort((a, b) => b.amount - a.amount);

  const monthName = startOfMonth.toLocaleDateString("en-AU", { month: "long", year: "numeric" });

  return (
    <div className="p-6 space-y-6">
      {/* Header with navigation */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/dashboard/reports" className="hover:underline">Reports</Link>
            <span>/</span>
            <span>Monthly Summary</span>
          </div>
          <h1 className="text-3xl font-bold">{monthName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/dashboard/reports/monthly?month=${prevMonth.getMonth() + 1}&year=${prevMonth.getFullYear()}`}>
            <Button variant="outline" size="icon">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <Link href={`/dashboard/reports/monthly?month=${nextMonth.getMonth() + 1}&year=${nextMonth.getFullYear()}`}>
            <Button variant="outline" size="icon" disabled={isCurrentMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spending</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(total)}</div>
            <p className="text-xs text-muted-foreground">
              {transactions?.length || 0} transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Essential</CardTitle>
            <TrendingDown className="h-4 w-4 text-essential" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(essential)}</div>
            <p className="text-xs text-muted-foreground">
              {total > 0 ? ((essential / total) * 100).toFixed(0) : 0}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Discretionary</CardTitle>
            <TrendingUp className="h-4 w-4 text-discretionary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(discretionary)}</div>
            <p className="text-xs text-muted-foreground">
              {total > 0 ? ((discretionary / total) * 100).toFixed(0) : 0}% of total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Spending Overview</CardTitle>
            <CardDescription>Essential vs Discretionary breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <SpendingOverview essential={essential} discretionary={discretionary} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Category Breakdown</CardTitle>
            <CardDescription>Top spending categories</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryBreakdown data={byCategory} />
          </CardContent>
        </Card>
      </div>

      {/* Category Details */}
      <Card>
        <CardHeader>
          <CardTitle>All Categories</CardTitle>
          <CardDescription>Complete breakdown by category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {categoryList.map((cat) => (
              <div key={cat.name} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      cat.classification === "Essential" ? "bg-green-500" : "bg-yellow-500"
                    }`}
                  />
                  <div>
                    <p className="font-medium">{cat.name}</p>
                    <p className="text-sm text-muted-foreground">{cat.count} transactions</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">{formatCurrency(cat.amount)}</p>
                  <p className="text-sm text-muted-foreground">
                    {total > 0 ? ((cat.amount / total) * 100).toFixed(1) : 0}%
                  </p>
                </div>
              </div>
            ))}
            {categoryList.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No transactions for this month
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Top Merchants */}
      <Card>
        <CardHeader>
          <CardTitle>Top Merchants</CardTitle>
          <CardDescription>Where you spent the most this month</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topMerchants.map(([merchant, amount], index) => (
              <div key={merchant} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground w-6">{index + 1}.</span>
                  <span className="font-medium">{merchant}</span>
                </div>
                <span>{formatCurrency(amount)}</span>
              </div>
            ))}
            {topMerchants.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No transactions for this month
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
