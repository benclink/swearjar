import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { AlertCircle, CheckCircle } from "lucide-react";
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

      {/* Progress Overview */}
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

      {/* Budget Cards */}
      {budgetStatus.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <p className="text-lg font-medium">No budgets set</p>
              <p className="text-sm text-muted-foreground mt-1">
                Set monthly budgets to track your spending. Try asking the chat assistant &quot;Set a $500 budget for Dining Out&quot;
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {budgetStatus.map((budget) => (
            <Card key={budget.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{budget.category}</CardTitle>
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
