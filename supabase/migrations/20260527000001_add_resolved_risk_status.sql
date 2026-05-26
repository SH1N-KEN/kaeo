-- Migration: Add 'resolved' to risk_status enum
-- The risk_status enum was originally defined as ('open', 'reviewed', 'confirmed', 'false_positive', 'ignored')
-- The application code and UI use 'resolved' as a valid status for closing risk events.

ALTER TYPE public.risk_status ADD VALUE IF NOT EXISTS 'resolved';
