import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft, Calendar, CreditCard, Tag, FileText, AlertCircle, Building } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TransactionEditForm } from "@/components/transactions/transaction-edit-form";
import type { Database } from "@/lib/supabase/types";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function TransactionDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Fetch transaction
  const { data: transactionData, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !transactionData) {
    notFound();
  }

  const transaction = transactionData as Transaction;

  // Fetch categories for the dropdown
  const { data: categories } = await supabase
    .from("categories")
    .select("name, classification")
    .order("display_order");

  // Fetch similar transactions (same merchant)
  const merchantFilter = transaction.merchant_normalised
    ? `merchant_normalised.eq.${transaction.merchant_normalised}`
    : `description.eq.${transaction.description}`;

  const { data: similarTransactionsRaw } = await supabase
    .from("transactions")
    .select("id, date, amount, category")
    .eq("user_id", user.id)
    .neq("id", id)
    .or(merchantFilter)
    .order("date", { ascending: false })
    .limit(5);

  const similarTransactions = similarTransactionsRaw as Array<{
    id: string;
    date: string;
    amount: number;
    category: string | null;
  }> | null;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/transactions"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Transactions
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {transaction.merchant_normalised || transaction.description}
            </h1>
            {transaction.merchant_normalised && (
              <p className="text-muted-foreground text-sm mt-1">
                {transaction.description}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className={`text-2xl font-bold ${transaction.amount < 0 ? "text-green-600" : ""}`}>
              {transaction.amount < 0 ? "+" : "-"}{formatCurrency(Math.abs(transaction.amount))}
            </p>
            <div className="flex items-center gap-2 justify-end mt-1">
              {transaction.needs_review && (
                <Badge variant="outline" className="text-orange-500 border-orange-500">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Needs Review
                </Badge>
              )}
              {transaction.category && (
                <Badge
                  variant={
                    transaction.classification === "Essential"
                      ? "essential"
                      : transaction.classification === "Discretionary"
                      ? "discretionary"
                      : "secondary"
                  }
                >
                  {transaction.category}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Transaction Details */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Date</p>
                <p className="font-medium">
                  {formatDate(transaction.date)}
                  {transaction.time && ` at ${transaction.time}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Source</p>
                <p className="font-medium">{transaction.source}</p>
                {transaction.source_account && (
                  <p className="text-sm text-muted-foreground">{transaction.source_account}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Classification</p>
                <p className="font-medium">{transaction.classification || "Unclassified"}</p>
              </div>
            </div>

            {transaction.original_category && transaction.original_category !== transaction.category && (
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Original Category</p>
                  <p className="font-medium">{transaction.original_category}</p>
                </div>
              </div>
            )}

            {transaction.is_transfer && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium">Internal Transfer</p>
                <p className="text-xs text-muted-foreground">
                  This transaction is marked as a transfer between accounts
                </p>
              </div>
            )}

            {transaction.notes && (
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground">Notes</p>
                <p className="text-sm mt-1">{transaction.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Form */}
        <TransactionEditForm
          transaction={transaction}
          categories={categories || []}
        />
      </div>

      {/* Similar Transactions */}
      {similarTransactions && similarTransactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Similar Transactions
            </CardTitle>
            <CardDescription>
              Other transactions from the same merchant
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {similarTransactions.map((t) => (
                <Link
                  key={t.id}
                  href={`/dashboard/transactions/${t.id}`}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm">{formatDate(t.date)}</span>
                    {t.category && (
                      <Badge variant="outline" className="text-xs">
                        {t.category}
                      </Badge>
                    )}
                  </div>
                  <span className="font-medium">{formatCurrency(t.amount)}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
