// Context management tools
import { createClient } from "@/lib/supabase/server";
import { UserContext, OnboardingState, DEFAULT_USER_CONTEXT } from "@/lib/types/context";

// Type for database row
interface UserContextRow {
  user_id: string;
  household_members: unknown;
  deliberate_tradeoffs: unknown;
  non_negotiables: unknown;
  watch_patterns: unknown;
  seasonal_patterns: unknown;
  spending_targets: unknown;
  context_narrative: string | null;
  onboarding_complete: boolean;
}

interface OnboardingStateRow {
  user_id: string;
  conversation_id: string | null;
  phase: string;
  gathered_context: unknown;
  questions_asked: unknown;
}

export async function getUserContext(userId: string): Promise<UserContext> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("user_context")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    // Return default context if none exists
    return DEFAULT_USER_CONTEXT;
  }

  const row = data as UserContextRow;

  return {
    household_members: (row.household_members as UserContext["household_members"]) || [],
    deliberate_tradeoffs: (row.deliberate_tradeoffs as UserContext["deliberate_tradeoffs"]) || [],
    non_negotiables: (row.non_negotiables as UserContext["non_negotiables"]) || [],
    watch_patterns: (row.watch_patterns as UserContext["watch_patterns"]) || [],
    seasonal_patterns: (row.seasonal_patterns as UserContext["seasonal_patterns"]) || [],
    spending_targets: (row.spending_targets as UserContext["spending_targets"]) || {
      discretionary_pct: 35,
      specific: {},
    },
    context_narrative: row.context_narrative || "",
  };
}

export async function saveUserContext(userId: string, context: UserContext): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("user_context") as any).upsert(
    {
      user_id: userId,
      household_members: context.household_members,
      deliberate_tradeoffs: context.deliberate_tradeoffs,
      non_negotiables: context.non_negotiables,
      watch_patterns: context.watch_patterns,
      seasonal_patterns: context.seasonal_patterns,
      spending_targets: context.spending_targets,
      context_narrative: context.context_narrative,
      onboarding_complete: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

interface UpdateContextParams {
  field: string;
  action: "set" | "append" | "remove";
  value: unknown;
}

export async function updateUserContext(
  userId: string,
  params: UpdateContextParams
): Promise<{ success: boolean; error?: string }> {
  // Get current context
  const currentContext = await getUserContext(userId);

  // Apply the update
  const updatedContext = { ...currentContext };
  const field = params.field as keyof UserContext;

  if (params.action === "set") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (updatedContext as any)[field] = params.value;
  } else if (params.action === "append" && Array.isArray(updatedContext[field])) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (updatedContext as any)[field] = [...(updatedContext[field] as unknown[]), params.value];
  } else if (params.action === "remove" && Array.isArray(updatedContext[field])) {
    // For arrays, remove by matching item property or index
    const arr = updatedContext[field] as unknown[];
    if (typeof params.value === "number") {
      // Remove by index
      arr.splice(params.value, 1);
    } else if (typeof params.value === "object" && params.value !== null && "item" in params.value) {
      // Remove by matching item property
      const itemToRemove = (params.value as { item: string }).item;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (updatedContext as any)[field] = arr.filter((x: any) => x.item !== itemToRemove);
    }
  }

  // Save back
  return saveUserContext(userId, updatedContext);
}

export async function getOnboardingState(
  userId: string,
  conversationId?: string
): Promise<OnboardingState> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("onboarding_state")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    // Create initial state
    const initialState: OnboardingState = {
      phase: "intro",
      gathered_context: {},
      questions_asked: [],
    };

    // Insert it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("onboarding_state") as any).insert({
      user_id: userId,
      conversation_id: conversationId || null,
      phase: initialState.phase,
      gathered_context: initialState.gathered_context,
      questions_asked: initialState.questions_asked,
    });

    return initialState;
  }

  const row = data as OnboardingStateRow;

  return {
    phase: row.phase as OnboardingState["phase"],
    gathered_context: (row.gathered_context as Partial<UserContext>) || {},
    questions_asked: (row.questions_asked as string[]) || [],
  };
}

export async function saveOnboardingState(
  userId: string,
  conversationId: string | undefined,
  state: OnboardingState
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("onboarding_state") as any).upsert(
    {
      user_id: userId,
      conversation_id: conversationId || null,
      phase: state.phase,
      gathered_context: state.gathered_context,
      questions_asked: state.questions_asked,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function isOnboardingComplete(userId: string): Promise<boolean> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("user_context")
    .select("onboarding_complete")
    .eq("user_id", userId)
    .single();

  const row = data as { onboarding_complete: boolean } | null;
  return row?.onboarding_complete === true;
}

export async function clearOnboardingState(userId: string): Promise<void> {
  const supabase = await createClient();

  await supabase.from("onboarding_state").delete().eq("user_id", userId);
}
