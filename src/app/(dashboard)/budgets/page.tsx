import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
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
    };
  }) || [];

  // Calculate totals
  const totalBudgeted = budgets?.reduce((sum, b) => sum + b.amount, 0) || 0;
  const totalSpent = spending?.reduce((sum, t) => sum + t.amount, 0) || 0;
  const unallocatedIncome = totalIncome - totalBudgeted;
  const remainingFromIncome = totalIncome - totalSpent;

  return (
    <div className="p-8 space-y-8 max-w-6xl">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium">Budgets</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {Math.round(monthProgress * 100)}% through {now.toLocaleDateString("en-AU", { month: "long" })}
          </p>
        </div>
        <AddBudgetModal
          categories={categories || []}
          existingCategories={budgets?.map(b => b.category) || []}
        />
      </header>

      {/* Key Metrics */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Income</p>
          <p className="text-2xl font-medium tabular-nums">{formatCurrency(totalIncome)}</p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Budgeted</p>
          <p className="text-2xl font-medium tabular-nums">{formatCurrency(totalBudgeted)}</p>
          {totalIncome > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {((totalBudgeted / totalIncome) * 100).toFixed(0)}% allocated
            </p>
          )}
        </div>

        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Unallocated</p>
          <p className={`text-2xl font-medium tabular-nums ${unallocatedIncome < 0 ? "text-destructive" : ""}`}>
            {formatCurrency(unallocatedIncome)}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Remaining</p>
          <p className={`text-2xl font-medium tabular-nums ${remainingFromIncome >= 0 ? "text-essential" : "text-destructive"}`}>
            {remainingFromIncome >= 0 ? "+" : ""}{formatCurrency(remainingFromIncome)}
          </p>
        </div>
      </section>

      {/* Spending Progress */}
      {totalIncome > 0 && (
        <section>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Spending vs Income</span>
            <span className="tabular-nums">{((totalSpent / totalIncome) * 100).toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden relative">
            <div
              className="absolute top-0 bottom-0 w-px bg-foreground/30"
              style={{ left: `${monthProgress * 100}%` }}
            />
            <div
              className={`h-full ${totalSpent / totalIncome > monthProgress ? "bg-discretionary" : "bg-essential"}`}
              style={{ width: `${Math.min((totalSpent / totalIncome) * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {totalSpent / totalIncome <= monthProgress
              ? "On track"
              : "Ahead of pace"}
          </p>
        </section>
      )}

      {/* Budget Cards */}
      {budgetStatus.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <p className="font-medium">No budgets set</p>
              {totalIncome > 0 && (
                <div className="mt-4 text-sm text-muted-foreground">
                  <p>Suggested allocations based on your income:</p>
                  <div className="flex justify-center gap-4 mt-2">
                    <span>Essentials: {formatCurrency(totalIncome * 0.5)}</span>
                    <span>Discretionary: {formatCurrency(totalIncome * 0.3)}</span>
                    <span>Savings: {formatCurrency(totalIncome * 0.2)}</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {budgetStatus.map((budget) => (
            <Card key={budget.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{budget.category}</CardTitle>
                  <span className={`text-xs ${budget.onTrack ? "text-essential" : "text-discretionary"}`}>
                    {budget.onTrack ? "On track" : "Over pace"}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm tabular-nums">
                    <span>{formatCurrency(budget.actual)}</span>
                    <span className="text-muted-foreground">of {formatCurrency(budget.amount)}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        budget.percentUsed > 100
                          ? "bg-destructive"
                          : budget.onTrack
                          ? "bg-foreground"
                          : "bg-discretionary"
                      }`}
                      style={{ width: `${Math.min(budget.percentUsed, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{budget.percentUsed}%</span>
                    <span>{formatCurrency(budget.remaining)} left</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
