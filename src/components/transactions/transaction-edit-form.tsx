"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateTransaction, deleteTransaction } from "@/app/actions/transactions";
import { Loader2, Save, Trash2, CheckCircle } from "lucide-react";
import type { Database } from "@/lib/supabase/types";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];

interface TransactionEditFormProps {
  transaction: Transaction;
  categories: Array<{ name: string; classification: string }>;
}

export function TransactionEditForm({ transaction, categories }: TransactionEditFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    category: transaction.category || "",
    classification: transaction.classification || "",
    merchant_normalised: transaction.merchant_normalised || "",
    notes: transaction.notes || "",
    needs_review: transaction.needs_review,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    const result = await updateTransaction(transaction.id, {
      category: formData.category || null,
      classification: formData.classification as Transaction["classification"] || null,
      merchant_normalised: formData.merchant_normalised || null,
      notes: formData.notes || null,
      needs_review: formData.needs_review,
    });

    setIsLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    const result = await deleteTransaction(transaction.id);

    if (result.error) {
      setError(result.error);
      setIsDeleting(false);
    } else {
      router.push("/dashboard/transactions");
    }
  };

  const handleCategoryChange = (categoryName: string) => {
    const category = categories.find(c => c.name === categoryName);
    setFormData({
      ...formData,
      category: categoryName,
      classification: category?.classification || formData.classification,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Transaction</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="merchant">Merchant Name</Label>
            <Input
              id="merchant"
              value={formData.merchant_normalised}
              onChange={(e) => setFormData({ ...formData, merchant_normalised: e.target.value })}
              placeholder="Normalized merchant name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <select
              id="category"
              value={formData.category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">Select a category</option>
              {categories.map((cat) => (
                <option key={cat.name} value={cat.name}>
                  {cat.name} ({cat.classification})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="classification">Classification</Label>
            <select
              id="classification"
              value={formData.classification}
              onChange={(e) => setFormData({ ...formData, classification: e.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">Select classification</option>
              <option value="Essential">Essential</option>
              <option value="Discretionary">Discretionary</option>
              <option value="Non-Spending">Non-Spending</option>
              <option value="Income">Income</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add any notes about this transaction"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="needs_review"
              checked={formData.needs_review}
              onChange={(e) => setFormData({ ...formData, needs_review: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="needs_review" className="text-sm font-normal">
              Mark as needs review
            </Label>
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-500/10 text-green-600 rounded-lg text-sm flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Changes saved successfully
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>

          <div className="pt-4 border-t">
            {!showDeleteConfirm ? (
              <Button
                type="button"
                variant="outline"
                className="w-full text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Transaction
              </Button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground text-center">
                  Are you sure? This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="flex-1"
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Confirm Delete"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
