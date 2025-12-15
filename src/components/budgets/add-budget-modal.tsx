"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBudget } from "@/app/actions/budgets";
import { Plus, Loader2, X } from "lucide-react";

interface AddBudgetModalProps {
  categories: Array<{ name: string; classification: string }>;
  existingCategories: string[];
}

export function AddBudgetModal({ categories, existingCategories }: AddBudgetModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    category: "",
    amount: "",
    budget_type: "monthly" as "monthly" | "quarterly" | "annual",
    notes: "",
  });

  // Filter out categories that already have budgets
  const availableCategories = categories.filter(
    (c) => !existingCategories.includes(c.name)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      setError("Please enter a valid amount");
      setIsLoading(false);
      return;
    }

    if (!formData.category) {
      setError("Please select a category");
      setIsLoading(false);
      return;
    }

    const result = await createBudget({
      category: formData.category,
      amount,
      budget_type: formData.budget_type,
      notes: formData.notes || undefined,
    });

    setIsLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setIsOpen(false);
      setFormData({
        category: "",
        amount: "",
        budget_type: "monthly",
        notes: "",
      });
    }
  };

  if (!isOpen) {
    return (
      <Button onClick={() => setIsOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        Add Budget
      </Button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={() => setIsOpen(false)}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-background rounded-lg shadow-lg w-full max-w-md">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-semibold">Add Budget</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Select a category</option>
                {availableCategories.map((cat) => (
                  <option key={cat.name} value={cat.name}>
                    {cat.name} ({cat.classification})
                  </option>
                ))}
              </select>
              {availableCategories.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  All categories already have budgets set.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Budget Amount ($)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="500.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="budget_type">Budget Period</Label>
              <select
                id="budget_type"
                value={formData.budget_type}
                onChange={(e) => setFormData({ ...formData, budget_type: e.target.value as "monthly" | "quarterly" | "annual" })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any notes about this budget"
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading || availableCategories.length === 0}
                className="flex-1"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Create Budget"
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
