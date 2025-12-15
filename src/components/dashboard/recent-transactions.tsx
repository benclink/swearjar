"use client";

import Link from "next/link";
import { formatCurrency, formatDateShort } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RecentTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string | null;
  classification: string | null;
  merchant_normalised: string | null;
}

interface RecentTransactionsProps {
  transactions: RecentTransaction[];
}

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  if (transactions.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-muted-foreground">
        No transactions yet. Import some data to get started.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {transactions.map((transaction) => (
        <div
          key={transaction.id}
          className="flex items-center justify-between py-2"
        >
          <div className="flex items-center gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium leading-none">
                {transaction.merchant_normalised || transaction.description.substring(0, 40)}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDateShort(transaction.date)}
                {transaction.category && (
                  <>
                    {" · "}
                    <Badge
                      variant={
                        transaction.classification === "Essential"
                          ? "essential"
                          : transaction.classification === "Discretionary"
                          ? "discretionary"
                          : "secondary"
                      }
                      className="text-[10px] px-1.5 py-0"
                    >
                      {transaction.category}
                    </Badge>
                  </>
                )}
              </p>
            </div>
          </div>
          <div
            className={cn(
              "font-medium",
              transaction.amount < 0 ? "text-green-600" : ""
            )}
          >
            {transaction.amount < 0 ? "+" : "-"}
            {formatCurrency(Math.abs(transaction.amount))}
          </div>
        </div>
      ))}
      <div className="pt-2">
        <Link
          href="/dashboard/transactions"
          className="text-sm text-primary hover:underline"
        >
          View all transactions →
        </Link>
      </div>
    </div>
  );
}
