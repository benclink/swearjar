-- Migration: Agent tables for multi-agent system
-- This migration adds tables for user context, onboarding state, and insights

-- User context table - stores deep financial context from onboarding
CREATE TABLE IF NOT EXISTS user_context (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    household_members JSONB DEFAULT '[]'::jsonb,
    deliberate_tradeoffs JSONB DEFAULT '[]'::jsonb,
    non_negotiables JSONB DEFAULT '[]'::jsonb,
    watch_patterns JSONB DEFAULT '[]'::jsonb,
    seasonal_patterns JSONB DEFAULT '[]'::jsonb,
    spending_targets JSONB DEFAULT '{}'::jsonb,
    context_narrative TEXT,
    onboarding_complete BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Onboarding state table - tracks multi-turn onboarding interview progress
CREATE TABLE IF NOT EXISTS onboarding_state (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    phase TEXT DEFAULT 'intro' CHECK (phase IN ('intro', 'household', 'groceries', 'transport', 'subscriptions', 'bnpl', 'lifestyle', 'synthesis', 'complete')),
    gathered_context JSONB DEFAULT '{}'::jsonb,
    questions_asked JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insights table - stores generated insights for history
CREATE TABLE IF NOT EXISTS insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    priority TEXT CHECK (priority IN ('alert', 'warning', 'watch', 'observation', 'affirmation')),
    data_snapshot JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add agent_type to conversations table if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'conversations' AND column_name = 'agent_type') THEN
        ALTER TABLE conversations ADD COLUMN agent_type TEXT;
    END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_context_user ON user_context(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_state_user ON onboarding_state(user_id);
CREATE INDEX IF NOT EXISTS idx_insights_user_created ON insights(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_agent ON conversations(agent_type) WHERE agent_type IS NOT NULL;

-- Row Level Security
ALTER TABLE user_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_context
CREATE POLICY "Users can view own context" ON user_context
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own context" ON user_context
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own context" ON user_context
    FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for onboarding_state
CREATE POLICY "Users can view own onboarding state" ON onboarding_state
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own onboarding state" ON onboarding_state
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own onboarding state" ON onboarding_state
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own onboarding state" ON onboarding_state
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for insights
CREATE POLICY "Users can view own insights" ON insights
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own insights" ON insights
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_context_updated_at
    BEFORE UPDATE ON user_context
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_onboarding_state_updated_at
    BEFORE UPDATE ON onboarding_state
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
