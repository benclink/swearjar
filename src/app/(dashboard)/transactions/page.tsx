import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionTable } from "@/components/transactions/transaction-table";
import { TransactionFilters } from "@/components/transactions/transaction-filters";

interface PageProps {
  searchParams: Promise<{
    category?: string;
    classification?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    needsReview?: string;
    page?: string;
  }>;
}

export default async function TransactionsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Build query
  let query = supabase
    .from("transactions")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .order("time", { ascending: false });

  // Apply filters
  if (params.category) {
    query = query.eq("category", params.category);
  }
  if (params.classification) {
    query = query.eq("classification", params.classification);
  }
  if (params.search) {
    query = query.or(`description.ilike.%${params.search}%,merchant_normalised.ilike.%${params.search}%`);
  }
  if (params.startDate) {
    query = query.gte("date", params.startDate);
  }
  if (params.endDate) {
    query = query.lte("date", params.endDate);
  }
  if (params.needsReview === "true") {
    query = query.eq("needs_review", true);
  }

  // Pagination
  const page = parseInt(params.page || "1");
  const pageSize = 50;
  const offset = (page - 1) * pageSize;
  query = query.range(offset, offset + pageSize - 1);

  const { data: transactions, count } = await query;

  // Get categories for filter dropdown
  const { data: categories } = await supabase
    .from("categories")
    .select("name, classification")
    .order("display_order");

  const totalPages = Math.ceil((count || 0) / pageSize);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Transactions</h1>
        <p className="text-muted-foreground">
          View and manage all your transactions
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionFilters categories={categories || []} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {count} Transaction{count !== 1 ? "s" : ""}
          </CardTitle>
          <CardDescription>
            Page {page} of {totalPages || 1}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TransactionTable
            transactions={transactions || []}
            currentPage={page}
            totalPages={totalPages}
          />
        </CardContent>
      </Card>
    </div>
  );
}
