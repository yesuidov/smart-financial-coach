-- Smart Financial Coach Database Schema for Supabase
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user profiles table (extends auth.users)
CREATE TABLE public.user_profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    first_name TEXT,
    last_name TEXT,
    display_name TEXT,
    date_of_birth DATE,
    phone_number TEXT,
    risk_tolerance TEXT CHECK (risk_tolerance IN ('conservative', 'moderate', 'aggressive')),
    annual_income DECIMAL(12,2),
    net_worth DECIMAL(12,2),
    investment_experience TEXT CHECK (investment_experience IN ('beginner', 'intermediate', 'advanced')),
    onboarding_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create accounts table
CREATE TABLE public.accounts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    account_name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN ('checking', 'savings', 'investment', 'credit', 'loan')),
    account_number TEXT UNIQUE,
    balance DECIMAL(15,2) DEFAULT 0.00,
    available_balance DECIMAL(15,2) DEFAULT 0.00,
    currency_code TEXT DEFAULT 'USD',
    is_active BOOLEAN DEFAULT TRUE,
    interest_rate DECIMAL(5,4),
    credit_limit DECIMAL(15,2),
    minimum_balance DECIMAL(15,2),
    bank_name TEXT,
    bank_logo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create transactions table
CREATE TABLE public.transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    from_account_id UUID REFERENCES accounts(id),
    to_account_id UUID REFERENCES accounts(id),
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('transfer', 'deposit', 'withdrawal', 'payment', 'investment', 'dividend', 'interest')),
    amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    currency_code TEXT DEFAULT 'USD',
    description TEXT NOT NULL,
    category TEXT,
    ai_category TEXT,
    ai_insights JSONB,
    reference_number TEXT UNIQUE,
    status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    merchant TEXT,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB
);

-- Create financial goals table
CREATE TABLE public.financial_goals (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    goal_name TEXT NOT NULL,
    goal_type TEXT CHECK (goal_type IN ('emergency_fund', 'retirement', 'vacation', 'house', 'education', 'investment', 'debt_payoff', 'custom')),
    target_amount DECIMAL(15,2) NOT NULL CHECK (target_amount > 0),
    current_amount DECIMAL(15,2) DEFAULT 0.00 CHECK (current_amount >= 0),
    target_date DATE,
    priority INTEGER DEFAULT 1 CHECK (priority BETWEEN 1 AND 10),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notifications table for real-time updates
CREATE TABLE public.notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    data JSONB,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Row Level Security Policies

-- User profiles policies
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- Accounts policies
CREATE POLICY "Users can view own accounts" ON accounts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own accounts" ON accounts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own accounts" ON accounts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own accounts" ON accounts
    FOR DELETE USING (auth.uid() = user_id);

-- Transactions policies
CREATE POLICY "Users can view own transactions" ON transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions" ON transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions" ON transactions
    FOR UPDATE USING (auth.uid() = user_id);

-- Financial goals policies
CREATE POLICY "Users can view own goals" ON financial_goals
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own goals" ON financial_goals
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals" ON financial_goals
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own goals" ON financial_goals
    FOR DELETE USING (auth.uid() = user_id);

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notifications" ON notifications
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_user_profiles_user_id ON user_profiles(id);
CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_accounts_active ON accounts(user_id, is_active);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_accounts ON transactions(from_account_id, to_account_id);
CREATE INDEX idx_transactions_created_at ON transactions(user_id, created_at DESC);
CREATE INDEX idx_transactions_category ON transactions(user_id, category);
CREATE INDEX idx_goals_user_id ON financial_goals(user_id);
CREATE INDEX idx_goals_active ON financial_goals(user_id, is_active);
CREATE INDEX idx_notifications_user_id ON notifications(user_id, created_at DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_financial_goals_updated_at BEFORE UPDATE ON financial_goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate account numbers
CREATE OR REPLACE FUNCTION generate_account_number()
RETURNS TEXT AS $$
BEGIN
    RETURN 'ACC' || LPAD(FLOOR(RANDOM() * 10000000000)::TEXT, 10, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to create user profile after signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, display_name, created_at)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
        NOW()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile when user signs up
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Sample data insertion function (for demo purposes)
CREATE OR REPLACE FUNCTION create_sample_data(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    checking_account_id UUID;
    savings_account_id UUID;
    credit_account_id UUID;
BEGIN
    -- Create sample accounts
    INSERT INTO accounts (user_id, account_name, account_type, balance, available_balance, bank_name)
    VALUES 
        (p_user_id, 'Main Checking', 'checking', 2500.00, 2500.00, 'Chase Bank'),
        (p_user_id, 'Emergency Savings', 'savings', 5000.00, 5000.00, 'Chase Bank'),
        (p_user_id, 'Rewards Credit Card', 'credit', -1200.00, 8800.00, 'Chase Bank');
    
    -- Get account IDs
    SELECT id INTO checking_account_id FROM accounts WHERE user_id = p_user_id AND account_type = 'checking' LIMIT 1;
    SELECT id INTO savings_account_id FROM accounts WHERE user_id = p_user_id AND account_type = 'savings' LIMIT 1;
    SELECT id INTO credit_account_id FROM accounts WHERE user_id = p_user_id AND account_type = 'credit' LIMIT 1;
    
    -- Create sample transactions
    INSERT INTO transactions (user_id, from_account_id, amount, description, category, ai_category, merchant, transaction_type)
    VALUES 
        (p_user_id, checking_account_id, 85.50, 'Grocery shopping', 'food', 'food', 'Whole Foods', 'payment'),
        (p_user_id, checking_account_id, 45.00, 'Gas station fill-up', 'transportation', 'transportation', 'Shell', 'payment'),
        (p_user_id, credit_account_id, 120.00, 'Online shopping', 'shopping', 'shopping', 'Amazon', 'payment'),
        (p_user_id, checking_account_id, 25.00, 'Coffee and lunch', 'food', 'food', 'Starbucks', 'payment'),
        (p_user_id, checking_account_id, 75.00, 'Utility bill payment', 'utilities', 'utilities', 'Electric Company', 'payment');
    
    -- Create sample financial goals
    INSERT INTO financial_goals (user_id, goal_name, goal_type, target_amount, current_amount, target_date)
    VALUES 
        (p_user_id, 'Emergency Fund', 'emergency_fund', 10000.00, 5000.00, CURRENT_DATE + INTERVAL '12 months'),
        (p_user_id, 'Dream Vacation', 'vacation', 3000.00, 500.00, CURRENT_DATE + INTERVAL '8 months'),
        (p_user_id, 'House Down Payment', 'house', 50000.00, 15000.00, CURRENT_DATE + INTERVAL '24 months');
        
END;
$$ LANGUAGE plpgsql;