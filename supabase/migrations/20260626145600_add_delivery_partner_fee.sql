-- Migration: Add delivery_partner_fee column to orders table
-- This column tracks the fee paid to the delivery partner for each order,
-- added to the product delivery charges (ranging from ₹20.00 to ₹30.00).

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS delivery_partner_fee NUMERIC(10,2) NOT NULL DEFAULT 25.00 CHECK (delivery_partner_fee >= 20.00 AND delivery_partner_fee <= 30.00);

-- Update any existing orders to have a default delivery_partner_fee
UPDATE public.orders 
SET delivery_partner_fee = 25.00 
WHERE delivery_partner_fee IS NULL;
