-- Migration: Add order ledger columns and automated payout trigger
-- This adds balance fields to sellers and delivery_partners,
-- adds fee breakdown columns to orders, and sets up a trigger to distribute
-- funds on delivery.

-- 1. Add ledger columns to public.orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS items_total NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (items_total >= 0.00),
ADD COLUMN IF NOT EXISTS handling_charge NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (handling_charge >= 0.00),
ADD COLUMN IF NOT EXISTS small_cart_fee NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (small_cart_fee >= 0.00);

-- 2. Add balance column to public.sellers table
ALTER TABLE public.sellers 
ADD COLUMN IF NOT EXISTS balance NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0.00);

-- 3. Add balance column to public.delivery_partners table
ALTER TABLE public.delivery_partners 
ADD COLUMN IF NOT EXISTS balance NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0.00);

-- 4. Create trigger function to handle payout distribution upon order delivery
CREATE OR REPLACE FUNCTION public.handle_order_delivery_payout()
RETURNS TRIGGER AS $$
DECLARE
    order_items_total NUMERIC(10,2);
    order_delivery_fee NUMERIC(10,2);
BEGIN
    -- Check if order status transitioned to 'delivered'
    IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
        order_items_total := NEW.items_total;
        order_delivery_fee := NEW.delivery_partner_fee;

        -- Deposit delivery partner fee to delivery partner's balance
        IF NEW.delivery_partner_id IS NOT NULL THEN
            UPDATE public.delivery_partners
            SET balance = balance + order_delivery_fee
            WHERE id = NEW.delivery_partner_id;
        END IF;

        -- Deposit items total to seller's balance
        UPDATE public.sellers
        SET balance = balance + order_items_total
        WHERE id = NEW.seller_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Attach trigger to orders table
DROP TRIGGER IF EXISTS on_order_delivered ON public.orders;
CREATE TRIGGER on_order_delivered
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_order_delivery_payout();
