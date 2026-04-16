-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)
-- This creates the table that stores all beta tester submissions

CREATE TABLE submissions (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  name TEXT,
  email TEXT,
  total_score INTEGER,
  severity TEXT,
  prescription TEXT,
  gateway_why TEXT,
  gateway_tag TEXT,
  dimensions JSONB,
  lembke JSONB,
  context JSONB,
  plan TEXT
);

-- Allow anonymous inserts (for the beta prototype)
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous inserts" ON submissions
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anonymous reads" ON submissions
  FOR SELECT TO anon USING (true);
