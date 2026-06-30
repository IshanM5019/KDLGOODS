-- Migration: Add payout_upi columns to sellers and delivery_partners
-- This allows merchants and riders to set their UPI payment destination for admin settlements.

ALTER TABLE public.sellers 
ADD COLUMN IF NOT EXISTS payout_upi TEXT;

ALTER TABLE public.delivery_partners 
ADD COLUMN IF NOT EXISTS payout_upi TEXT;
