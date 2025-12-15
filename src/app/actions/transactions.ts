"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateTransaction(
  transactionId: string,
  data: {
    category?: string | null;
    classification?: "Essential" | "Discretionary" | "Non-Spending" | "Income" | null;
    merchant_normalised?: string | null;
    notes?: string | null;
    needs_review?: boolean;
  }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("transactions") as any)
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", transactionId)
    .eq("user_id", user.id);

  if (error) {
    return { error: String(error.message || error) };
  }

  revalidatePath("/transactions");
  revalidatePath(`/transactions/${transactionId}`);
  revalidatePath("/dashboard");

  return { success: true };
}

export async function deleteTransaction(transactionId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("transactions") as any)
    .delete()
    .eq("id", transactionId)
    .eq("user_id", user.id);

  if (error) {
    return { error: String(error.message || error) };
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");

  return { success: true };
}
