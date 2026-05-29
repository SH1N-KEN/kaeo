-- Migration: Add Staff Spend Review Fields to Transactions Table
-- Phase 1 of Staff Spend Review

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS paid_by text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS proof_status text DEFAULT 'not_required',
ADD COLUMN IF NOT EXISTS is_staff_expense boolean DEFAULT false;
