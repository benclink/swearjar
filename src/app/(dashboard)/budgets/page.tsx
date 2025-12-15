import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { AlertCircle, CheckCircle, Wallet, PiggyBank, TrendingUp } from "lucide-react";
import { AddBudgetModal } from "@/components/budgets/add-budget-modal";

interface Budget {
  id: string;
  category: string;
  amount: number;
}

interface BudgetStatus extends Budget {
  actual: number;
  remaining: number;
  percentUsed: number;
  onTrack: boolean;
  status: string;
}

export default async function BudgetsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Get budgets
  const { data: budgetsData } = await supabase
    .from("budgets")
    .select("id, category, amount")
    .eq("user_id", user.id)
    .eq("budget_type", "monthly")
    .order("category");

  const budgets = budgetsData as Budget[] | null;

  // Get categories for the add budget modal
  const { data: categories } = await supabase
    .from("categories")
    .select("name, classification")
    .order("display_order");

  // Get current month spending
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  const { data: spendingData } = await supabase
    .from("transactions")
    .select("category, amount")
    .eq("user_id", user.id)
    .gte("date", startOfMonth)
    .lte("date", endOfMonth)
    .gt("amount", 0)
    .in("classification", ["Essential", "Discretionary"]);

  const spending = spendingData as Array<{ category: string | null; amount: number }> | null;

  // Get current month income (negative amounts are income)
  const { data: incomeData } = await supabase
    .from("transactions")
    .select("amount")
    .eq("user_id", user.id)
    .gte("date", startOfMonth)
    .lte("date", endOfMonth)
    .lt("amount", 0);

  const incomeTransactions = incomeData as Array<{ amount: number }> | null;
  const totalIncome = incomeTransactions?.reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;

  // Aggregate spending by category
  const spendingByCategory: Record<string, number> = {};
  spending?.forEach((t) => {
    const cat = t.category || "Uncategorized";
    spendingByCategory[cat] = (spendingByCategory[cat] || 0) + t.amount;
  });

  // Calculate progress
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthProgress = now.getDate() / daysInMonth;

  const budgetStatus: BudgetStatus[] = budgets?.map((b) => {
    const actual = spendingByCategory[b.category] || 0;
    const paceTarget = b.amount * monthProgress;
    const percentUsed = (actual / b.amount) * 100;
    const onTrack = actual <= paceTarget;

    return {
      ...b,
      actual,
      remaining: b.amount - actual,
      percentUsed: Math.round(percentUsed),
      onTrack,
      status: onTrack ? "on_track" : percentUsed > 100 ? "over_budget" : "at_risk",
    };
  }) || [];

  // Calculate totals
  const totalBudgeted = budgets?.reduce((sum, b) => sum + b.amount, 0) || 0;
  const totalSpent = spending?.reduce((sum, t) => sum + t.amount, 0) || 0;
  const unallocatedIncome = totalIncome - totalBudgeted;
  const remainingFromIncome = totalIncome - totalSpent;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Budgets</h1>
          <p className="text-muted-foreground">
            Track your spending against monthly budgets
          </p>
        </div>
        <AddBudgetModal
          categories={categories || []}
          existingCategories={budgets?.map(b => b.category) || []}
        />
      </div>

      {/* Income & Budget Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Income</CardTitle>
            <Wallet className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</div>
            <p className="text-xs text-muted-foreground">
              Total income this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Budgeted</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalBudgeted)}</div>
            <p className="text-xs text-muted-foreground">
              {totalIncome > 0
                ? `${((totalBudgeted / totalIncome) * 100).toFixed(0)}% of income allocated`
                : "Set budgets to track spending"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unallocated</CardTitle>
            <PiggyBank className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${unallocatedIncome >= 0 ? "text-blue-600" : "text-orange-500"}`}>
              {formatCurrency(unallocatedIncome)}
            </div>
            <p className="text-xs text-muted-foreground">
              {unallocatedIncome >= 0
                ? "Income not assigned to budgets"
                : "Budgets exceed income"}
            </p>
          </CardContent>
        </Card>

        <Card className={remainingFromIncome >= 0 ? "border-green-500/50" : "border-red-500/50"}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Remaining</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${remainingFromIncome >= 0 ? "text-green-600" : "text-destructive"}`}>
              {remainingFromIncome >= 0 ? "+" : ""}{formatCurrency(remainingFromIncome)}
            </div>
            <p className="text-xs text-muted-foreground">
              {remainingFromIncome >= 0
                ? `${totalIncome > 0 ? ((remainingFromIncome / totalIncome) * 100).toFixed(0) : 0}% of income remaining`
                : "Overspent this month"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Spending vs Income Progress */}
      {totalIncome > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Income Utilization</CardTitle>
            <CardDescription>
              {Math.round(monthProgress * 100)}% through {now.toLocaleDateString("en-AU", { month: "long" })} &bull; {formatCurrency(totalSpent)} of {formatCurrency(totalIncome)} spent
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Spending Progress</span>
                <span className={totalSpent > totalIncome ? "text-destructive" : ""}>
                  {((totalSpent / totalIncome) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden relative">
                {/* Expected pace marker */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-foreground/30 z-10"
                  style={{ left: `${monthProgress * 100}%` }}
                />
                <div
                  className={`h-full transition-all ${
                    totalSpent / totalIncome > monthProgress
                      ? "bg-orange-500"
                      : "bg-green-500"
                  }`}
                  style={{ width: `${Math.min((totalSpent / totalIncome) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {totalSpent / totalIncome <= monthProgress
                  ? "On track - spending below expected pace"
                  : "Ahead of pace - spending faster than expected"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Month Progress (shown when no income) */}
      {totalIncome === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Month Progress</CardTitle>
            <CardDescription>
              {Math.round(monthProgress * 100)}% through {now.toLocaleDateString("en-AU", { month: "long" })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${monthProgress * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Budget Cards */}
      {budgetStatus.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <p className="text-lg font-medium">No budgets set</p>
              {totalIncome > 0 ? (
                <div className="mt-2 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Based on your {formatCurrency(totalIncome)} income, here are some suggested allocations:
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 mt-3">
                    <span className="text-xs bg-muted px-2 py-1 rounded">
                      Essentials: {formatCurrency(totalIncome * 0.5)} (50%)
                    </span>
                    <span className="text-xs bg-muted px-2 py-1 rounded">
                      Discretionary: {formatCurrency(totalIncome * 0.3)} (30%)
                    </span>
                    <span className="text-xs bg-muted px-2 py-1 rounded">
                      Savings: {formatCurrency(totalIncome * 0.2)} (20%)
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Try asking the chat assistant &quot;Set a {formatCurrency(Math.round(totalIncome * 0.1))} budget for Dining Out&quot;
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">
                  Set monthly budgets to track your spending. Try asking the chat assistant &quot;Set a $500 budget for Dining Out&quot;
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {budgetStatus.map((budget) => (
            <Card key={budget.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{budget.category}</CardTitle>
                    {totalIncome > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {((budget.amount / totalIncome) * 100).toFixed(0)}% of income
                      </p>
                    )}
                  </div>
                  {budget.onTrack ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-orange-500" />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{formatCurrency(budget.actual)} spent</span>
                    <span className="text-muted-foreground">of {formatCurrency(budget.amount)}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        budget.percentUsed > 100
                          ? "bg-destructive"
                          : budget.onTrack
                          ? "bg-green-500"
                          : "bg-orange-500"
                      }`}
                      style={{ width: `${Math.min(budget.percentUsed, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{budget.percentUsed}% used</span>
                    <span>{formatCurrency(budget.remaining)} remaining</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
