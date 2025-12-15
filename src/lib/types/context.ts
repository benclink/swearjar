// Types for user financial context

export interface HouseholdMember {
  name: string;
  role: string; // e.g., "primary earner", "partner", "child"
  tendencies?: string[]; // e.g., ["impulse buyer", "frugal", "tech enthusiast"]
}

export interface DeliberateTradeoff {
  item: string; // e.g., "Marley Spoon subscription"
  reasoning: string; // e.g., "Saves time on meal planning, reduces food waste"
  do_not_flag: boolean; // Should not be flagged as overspending
  amount_range?: { min: number; max: number }; // Expected spending range
}

export interface NonNegotiable {
  item: string; // e.g., "Kids activities", "Coffee subscription"
  reason: string; // e.g., "Important for children's development"
  category?: string; // Related category
}

export interface WatchPattern {
  pattern: string; // e.g., "uber_eats_spike"
  description: string; // e.g., "Multiple UberEats orders in a week"
  meaning: string; // e.g., "Usually means stressful week at work"
  action: string; // e.g., "Just acknowledge, don't lecture"
  threshold?: {
    amount?: number;
    count?: number;
    period_days?: number;
  };
}

export interface SeasonalPattern {
  months: number[]; // 1-12
  categories: string[]; // Affected categories
  note: string; // e.g., "Christmas shopping", "Back to school"
  expected_increase_pct?: number;
}

export interface SpendingTargets {
  discretionary_pct: number; // Target percentage of spending that's discretionary
  specific: Record<string, number>; // Category-specific monthly targets
}

export interface UserContext {
  household_members: HouseholdMember[];
  deliberate_tradeoffs: DeliberateTradeoff[];
  non_negotiables: NonNegotiable[];
  watch_patterns: WatchPattern[];
  seasonal_patterns: SeasonalPattern[];
  spending_targets: SpendingTargets;
  context_narrative: string; // Free-form narrative about their financial situation
}

// Onboarding state phases
export type OnboardingPhase =
  | "intro"
  | "household"
  | "groceries"
  | "transport"
  | "subscriptions"
  | "bnpl"
  | "lifestyle"
  | "synthesis"
  | "complete";

export interface OnboardingState {
  phase: OnboardingPhase;
  gathered_context: Partial<UserContext>;
  questions_asked: string[];
}

// Default empty context for new users
export const DEFAULT_USER_CONTEXT: UserContext = {
  household_members: [],
  deliberate_tradeoffs: [],
  non_negotiables: [],
  watch_patterns: [],
  seasonal_patterns: [],
  spending_targets: {
    discretionary_pct: 35,
    specific: {},
  },
  context_narrative: "",
};
