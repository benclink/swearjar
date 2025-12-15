"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import type { Database } from "@/lib/supabase/types";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];

interface TransactionTableProps {
  transactions: Transaction[];
  currentPage: number;
  totalPages: number;
}

export function TransactionTable({
  transactions,
  currentPage,
  totalPages,
}: TransactionTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`?${params.toString()}`);
  };

  if (transactions.length === 0) {
    return (
      <div className="flex h-[400px] items-center justify-center text-muted-foreground">
        No transactions found matching your filters.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b text-left text-sm text-muted-foreground">
              <th className="pb-3 font-medium">Date</th>
              <th className="pb-3 font-medium">Description</th>
              <th className="pb-3 font-medium">Category</th>
              <th className="pb-3 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => (
              <tr
                key={transaction.id}
                className="border-b last:border-0 hover:bg-muted/50 cursor-pointer"
                onClick={() => router.push(`/transactions/${transaction.id}`)}
              >
                <td className="py-3 text-sm">
                  {formatDate(transaction.date)}
                </td>
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    {transaction.needs_review && (
                      <AlertCircle className="h-4 w-4 text-orange-500 shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {transaction.merchant_normalised ||
                          transaction.description.substring(0, 50)}
                      </p>
                      {transaction.merchant_normalised && (
                        <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                          {transaction.description}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-3">
                  {transaction.category ? (
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
                  ) : (
                    <Badge variant="outline">Uncategorized</Badge>
                  )}
                </td>
                <td
                  className={cn(
                    "py-3 text-right font-medium",
                    transaction.amount < 0 ? "text-green-600" : ""
                  )}
                >
                  {transaction.amount < 0 ? "+" : "-"}
                  {formatCurrency(Math.abs(transaction.amount))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {currentPage} of {totalPages}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
