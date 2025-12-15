-- Personal Finance Dashboard Schema for Supabase
-- Run this in the Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES TABLE (extends Supabase Auth)
-- ============================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name)
    VALUES (NEW.id, NEW.email, SPLIT_PART(NEW.email, '@', 1));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- CATEGORIES TABLE (reference data)
-- ============================================
CREATE TABLE categories (
    name TEXT PRIMARY KEY,
    classification TEXT NOT NULL CHECK (classification IN ('Essential', 'Discretionary', 'Non-Spending', 'Income')),
    description TEXT,
    display_order INTEGER
);

-- Seed categories
INSERT INTO categories (name, classification, display_order) VALUES
-- Essential
('Groceries', 'Essential', 1),
('Utilities', 'Essential', 2),
('Insurance', 'Essential', 3),
('Healthcare', 'Essential', 4),
('Transport - Fuel', 'Essential', 5),
('Transport - Tolls', 'Essential', 6),
('Transport - Other', 'Essential', 7),
('Mortgage', 'Essential', 8),
('Loan Repayments', 'Essential', 9),
('BNPL Instalments', 'Essential', 10),
('BNPL Fees & Interest', 'Essential', 11),
('Pets', 'Essential', 12),
('Kids', 'Essential', 13),
-- Discretionary
('Dining Out', 'Discretionary', 20),
('Alcohol', 'Discretionary', 21),
('Entertainment', 'Discretionary', 22),
('Clothing & Personal', 'Discretionary', 23),
('Gifts', 'Discretionary', 24),
('Subscriptions - Media', 'Discretionary', 25),
('Subscriptions - Software', 'Discretionary', 26),
('Subscriptions - Food', 'Discretionary', 27),
('Shopping - General', 'Discretionary', 28),
('Shopping - Online', 'Discretionary', 29),
('Home & Garden', 'Discretionary', 30),
-- Non-Spending
('Transfer - Internal', 'Non-Spending', 40),
('Transfer - Family', 'Non-Spending', 41),
-- Income
('Income - Salary', 'Income', 50),
('Income - Other', 'Income', 51);

-- ============================================
-- TRANSACTIONS TABLE (main data)
-- ============================================
CREATE TABLE transactions (
    id TEXT PRIMARY KEY,  -- Keep original IDs from bank
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    time TIME,
    description TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL,  -- Positive = expense, Negative = income
    source TEXT NOT NULL,  -- 'ubank', 'paypal', 'zip', 'afterpay'
    source_account TEXT,
    classification TEXT CHECK (classification IN ('Essential', 'Discretionary', 'Non-Spending', 'Income')),
    category TEXT REFERENCES categories(name),
    original_category TEXT,
    merchant_normalised TEXT,
    is_transfer BOOLEAN DEFAULT FALSE,
    linked_bnpl_id TEXT,
    needs_review BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_date ON transactions(user_id, date DESC);
CREATE INDEX idx_transactions_category ON transactions(category);
CREATE INDEX idx_transactions_classification ON transactions(classification);
CREATE INDEX idx_transactions_needs_review ON transactions(user_id, needs_review) WHERE needs_review = TRUE;

-- ============================================
-- MERCHANT MAPPINGS TABLE
-- ============================================
CREATE TABLE merchant_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,  -- NULL = global
    merchant_pattern TEXT NOT NULL,
    category TEXT NOT NULL REFERENCES categories(name),
    classification TEXT CHECK (classification IN ('Essential', 'Discretionary', 'Non-Spending', 'Income')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, merchant_pattern)
);

-- ============================================
-- BUDGETS TABLE
-- ============================================
CREATE TABLE budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    category TEXT NOT NULL REFERENCES categories(name),
    budget_type TEXT NOT NULL CHECK (budget_type IN ('monthly', 'quarterly', 'annual')),
    amount NUMERIC(10,2) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, category, budget_type, effective_from)
);

-- ============================================
-- CONVERSATIONS TABLE (for chat history)
-- ============================================
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT NOT NULL,
    tool_calls JSONB,
    tool_results JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);

-- ============================================
-- CSV IMPORTS TABLE (tracking)
-- ============================================
CREATE TABLE csv_imports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_type TEXT NOT NULL,  -- 'ubank', 'paypal', 'afterpay'
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    total_rows INTEGER,
    imported_rows INTEGER,
    skipped_rows INTEGER,
    error_message TEXT,
    storage_path TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- ============================================
-- VIEWS
-- ============================================

-- Monthly spending by category
CREATE VIEW v_monthly_spending AS
SELECT
    user_id,
    DATE_TRUNC('month', date)::DATE as month,
    category,
    classification,
    COUNT(*) as transaction_count,
    SUM(amount) as total_amount,
    AVG(amount) as avg_transaction
FROM transactions
WHERE classification IN ('Essential', 'Discretionary')
  AND amount > 0
GROUP BY user_id, DATE_TRUNC('month', date), category, classification;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all user-owned tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE csv_imports ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only access their own profile
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- Transactions: users can only access their own transactions
CREATE POLICY "Users can view own transactions"
    ON transactions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
    ON transactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions"
    ON transactions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions"
    ON transactions FOR DELETE
    USING (auth.uid() = user_id);

-- Merchant mappings: users can see global (null user_id) or their own
CREATE POLICY "Users can view global and own mappings"
    ON merchant_mappings FOR SELECT
    USING (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "Users can insert own mappings"
    ON merchant_mappings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own mappings"
    ON merchant_mappings FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own mappings"
    ON merchant_mappings FOR DELETE
    USING (auth.uid() = user_id);

-- Budgets
CREATE POLICY "Users can view own budgets"
    ON budgets FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own budgets"
    ON budgets FOR ALL
    USING (auth.uid() = user_id);

-- Conversations
CREATE POLICY "Users can view own conversations"
    ON conversations FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own conversations"
    ON conversations FOR ALL
    USING (auth.uid() = user_id);

-- Messages (through conversation ownership)
CREATE POLICY "Users can view messages in own conversations"
    ON messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM conversations c
            WHERE c.id = messages.conversation_id
            AND c.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert messages in own conversations"
    ON messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM conversations c
            WHERE c.id = messages.conversation_id
            AND c.user_id = auth.uid()
        )
    );

-- CSV Imports
CREATE POLICY "Users can view own imports"
    ON csv_imports FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own imports"
    ON csv_imports FOR ALL
    USING (auth.uid() = user_id);

-- Categories table is public read
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categories are publicly readable"
    ON categories FOR SELECT
    TO authenticated
    USING (true);
