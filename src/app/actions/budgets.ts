"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createBudget(data: {
  category: string;
  amount: number;
  budget_type: "monthly" | "quarterly" | "annual";
  notes?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // Check if budget already exists for this category
  const { data: existingData } = await supabase
    .from("budgets")
    .select("id")
    .eq("user_id", user.id)
    .eq("category", data.category)
    .eq("budget_type", data.budget_type)
    .maybeSingle();

  const existingId = (existingData as { id: string } | null)?.id;

  if (existingId) {
    // Update existing budget
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("budgets") as any)
      .update({
        amount: data.amount,
        notes: data.notes || null,
      })
      .eq("id", existingId);

    if (error) {
      return { error: String(error.message || error) };
    }
  } else {
    // Create new budget
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("budgets") as any)
      .insert({
        user_id: user.id,
        category: data.category,
        amount: data.amount,
        budget_type: data.budget_type,
        effective_from: new Date().toISOString().split("T")[0],
        notes: data.notes || null,
      });

    if (error) {
      return { error: String(error.message || error) };
    }
  }

  revalidatePath("/budgets");
  revalidatePath("/dashboard");

  return { success: true };
}

export async function deleteBudget(budgetId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("budgets")
    .delete()
    .eq("id", budgetId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/budgets");
  revalidatePath("/dashboard");

  return { success: true };
}
