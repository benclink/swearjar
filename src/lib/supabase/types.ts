export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          time: string | null;
          description: string;
          amount: number;
          source: string;
          source_account: string | null;
          classification: "Essential" | "Discretionary" | "Non-Spending" | "Income" | null;
          category: string | null;
          original_category: string | null;
          merchant_normalised: string | null;
          is_transfer: boolean;
          linked_bnpl_id: string | null;
          needs_review: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          date: string;
          time?: string | null;
          description: string;
          amount: number;
          source: string;
          source_account?: string | null;
          classification?: "Essential" | "Discretionary" | "Non-Spending" | "Income" | null;
          category?: string | null;
          original_category?: string | null;
          merchant_normalised?: string | null;
          is_transfer?: boolean;
          linked_bnpl_id?: string | null;
          needs_review?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          time?: string | null;
          description?: string;
          amount?: number;
          source?: string;
          source_account?: string | null;
          classification?: "Essential" | "Discretionary" | "Non-Spending" | "Income" | null;
          category?: string | null;
          original_category?: string | null;
          merchant_normalised?: string | null;
          is_transfer?: boolean;
          linked_bnpl_id?: string | null;
          needs_review?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      merchant_mappings: {
        Row: {
          id: string;
          user_id: string | null;
          merchant_pattern: string;
          category: string;
          classification: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          merchant_pattern: string;
          category: string;
          classification?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          merchant_pattern?: string;
          category?: string;
          classification?: string | null;
          notes?: string | null;
          created_at?: string;
        };
      };
      budgets: {
        Row: {
          id: string;
          user_id: string;
          category: string;
          budget_type: "monthly" | "quarterly" | "annual";
          amount: number;
          effective_from: string;
          effective_to: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category: string;
          budget_type: "monthly" | "quarterly" | "annual";
          amount: number;
          effective_from: string;
          effective_to?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          category?: string;
          budget_type?: "monthly" | "quarterly" | "annual";
          amount?: number;
          effective_from?: string;
          effective_to?: string | null;
          notes?: string | null;
          created_at?: string;
        };
      };
      conversations: {
        Row: {
          id: string;
          user_id: string;
          title: string | null;
          agent_type: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string | null;
          agent_type?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string | null;
          agent_type?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: "user" | "assistant" | "system" | "tool";
          content: string;
          tool_calls: Json | null;
          tool_results: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: "user" | "assistant" | "system" | "tool";
          content: string;
          tool_calls?: Json | null;
          tool_results?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          role?: "user" | "assistant" | "system" | "tool";
          content?: string;
          tool_calls?: Json | null;
          tool_results?: Json | null;
          created_at?: string;
        };
      };
      categories: {
        Row: {
          name: string;
          classification: string;
          description: string | null;
          display_order: number | null;
        };
        Insert: {
          name: string;
          classification: string;
          description?: string | null;
          display_order?: number | null;
        };
        Update: {
          name?: string;
          classification?: string;
          description?: string | null;
          display_order?: number | null;
        };
      };
      csv_imports: {
        Row: {
          id: string;
          user_id: string;
          filename: string;
          file_type: string;
          status: "pending" | "processing" | "completed" | "failed";
          total_rows: number | null;
          imported_rows: number | null;
          skipped_rows: number | null;
          error_message: string | null;
          storage_path: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          filename: string;
          file_type: string;
          status?: "pending" | "processing" | "completed" | "failed";
          total_rows?: number | null;
          imported_rows?: number | null;
          skipped_rows?: number | null;
          error_message?: string | null;
          storage_path?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          filename?: string;
          file_type?: string;
          status?: "pending" | "processing" | "completed" | "failed";
          total_rows?: number | null;
          imported_rows?: number | null;
          skipped_rows?: number | null;
          error_message?: string | null;
          storage_path?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
      };
      user_context: {
        Row: {
          user_id: string;
          household_members: Json;
          deliberate_tradeoffs: Json;
          non_negotiables: Json;
          watch_patterns: Json;
          seasonal_patterns: Json;
          spending_targets: Json;
          context_narrative: string | null;
          onboarding_complete: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          household_members?: Json;
          deliberate_tradeoffs?: Json;
          non_negotiables?: Json;
          watch_patterns?: Json;
          seasonal_patterns?: Json;
          spending_targets?: Json;
          context_narrative?: string | null;
          onboarding_complete?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          household_members?: Json;
          deliberate_tradeoffs?: Json;
          non_negotiables?: Json;
          watch_patterns?: Json;
          seasonal_patterns?: Json;
          spending_targets?: Json;
          context_narrative?: string | null;
          onboarding_complete?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      onboarding_state: {
        Row: {
          user_id: string;
          conversation_id: string | null;
          phase: "intro" | "household" | "groceries" | "transport" | "subscriptions" | "bnpl" | "lifestyle" | "synthesis" | "complete";
          gathered_context: Json;
          questions_asked: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          conversation_id?: string | null;
          phase?: "intro" | "household" | "groceries" | "transport" | "subscriptions" | "bnpl" | "lifestyle" | "synthesis" | "complete";
          gathered_context?: Json;
          questions_asked?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          conversation_id?: string | null;
          phase?: "intro" | "household" | "groceries" | "transport" | "subscriptions" | "bnpl" | "lifestyle" | "synthesis" | "complete";
          gathered_context?: Json;
          questions_asked?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      insights: {
        Row: {
          id: string;
          user_id: string;
          content: string;
          priority: "alert" | "warning" | "watch" | "observation" | "affirmation" | null;
          data_snapshot: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          content: string;
          priority?: "alert" | "warning" | "watch" | "observation" | "affirmation" | null;
          data_snapshot?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          content?: string;
          priority?: "alert" | "warning" | "watch" | "observation" | "affirmation" | null;
          data_snapshot?: Json | null;
          created_at?: string;
        };
      };
    };
    Views: {
      v_monthly_spending: {
        Row: {
          user_id: string;
          month: string;
          category: string;
          classification: string;
          transaction_count: number;
          total_amount: number;
          avg_transaction: number;
        };
      };
    };
    Functions: {};
    Enums: {};
  };
}
