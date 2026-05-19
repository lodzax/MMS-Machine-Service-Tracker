-- SQL Migration to fix missing columns for CRM Loyalty feature
-- Run this in your Supabase SQL Editor

-- Add columns to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS loyalty_points INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_spend NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS change_credit NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS installation_balance NUMERIC DEFAULT 0;

-- Add columns to machinery table
ALTER TABLE machinery
ADD COLUMN IF NOT EXISTS purchase_price NUMERIC DEFAULT 0;

-- Create loyalty history table
CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('PURCHASE', 'REDEMPTION', 'CHANGE_CREDIT', 'CREDIT_SPENT')),
    amount NUMERIC DEFAULT 0,
    points INTEGER DEFAULT 0,
    invoice_number TEXT,
    description TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create after sales service history table
CREATE TABLE IF NOT EXISTS after_sales_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('INSTALLATION_FEE', 'SERVICE_EXPENSE', 'TOP_UP')),
    amount NUMERIC DEFAULT 0,
    invoice_number TEXT,
    description TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for new tables
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE after_sales_transactions ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies (Allow all authenticated users)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'loyalty_transactions' AND policyname = 'Enable all for authenticated users') THEN
        CREATE POLICY "Enable all for authenticated users" ON loyalty_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'after_sales_transactions' AND policyname = 'Enable all for authenticated users') THEN
        CREATE POLICY "Enable all for authenticated users" ON after_sales_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;
