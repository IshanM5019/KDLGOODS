-- ==========================================
-- KDLGOODS COMPLETE CONSOLIDATED MIGRATION
-- Run this in your Supabase SQL Editor
-- ==========================================

-- 1. Enable PostGIS Extension if missing
CREATE EXTENSION IF NOT EXISTS postgis SCHEMA public;

-- 2. Add New Enum Values for Order Status
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'preparing';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'awaiting_pickup';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'driver_accepted';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'picked_up';

-- 3. Add Custom Payment Details and Cash Flow Fields to Orders
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'cod',
ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS upi_transaction_id TEXT,
ADD COLUMN IF NOT EXISTS upi_screenshot_url TEXT,
ADD COLUMN IF NOT EXISTS driver_cash_submitted BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS driver_cash_txn_id TEXT,
ADD COLUMN IF NOT EXISTS driver_cash_screenshot_url TEXT;

-- Enforce Valid Options for Payments
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS check_payment_method;
ALTER TABLE public.orders ADD CONSTRAINT check_payment_method CHECK (payment_method IN ('cod', 'upi'));

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS check_payment_status;
ALTER TABLE public.orders ADD CONSTRAINT check_payment_status CHECK (payment_status IN ('pending', 'paid'));

-- 4. Add Ledger Columns to public.orders Table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS items_total NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (items_total >= 0.00),
ADD COLUMN IF NOT EXISTS handling_charge NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (handling_charge >= 0.00),
ADD COLUMN IF NOT EXISTS small_cart_fee NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (small_cart_fee >= 0.00);

-- 5. Add delivery_partner_fee Column to Orders Table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS delivery_partner_fee NUMERIC(10,2) NOT NULL DEFAULT 25.00 CHECK (delivery_partner_fee >= 20.00 AND delivery_partner_fee <= 30.00);

-- Update any existing orders
UPDATE public.orders 
SET delivery_partner_fee = 25.00 
WHERE delivery_partner_fee IS NULL;

-- 5. Add Address Column to Profiles Table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address TEXT;

-- 6. Add Ledger & Balance Columns to Partners & Sellers
ALTER TABLE public.delivery_partners ADD COLUMN IF NOT EXISTS balance NUMERIC(10,2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.sellers ADD COLUMN IF NOT EXISTS balance NUMERIC(10,2) NOT NULL DEFAULT 0.00;

-- 7. Create Payout Logs Table
CREATE TABLE IF NOT EXISTS public.payout_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    account_details TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payout_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their payouts" ON public.payout_logs;
CREATE POLICY "Users can view their payouts" 
    ON public.payout_logs FOR SELECT 
    TO authenticated 
    USING (user_id = auth.uid());
    
DROP POLICY IF EXISTS "Users can request payouts" ON public.payout_logs;
CREATE POLICY "Users can request payouts" 
    ON public.payout_logs FOR INSERT 
    TO authenticated 
    WITH CHECK (user_id = auth.uid());

-- 8. Create Order Messages Table (Order Chats)
CREATE TABLE IF NOT EXISTS public.order_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    sender_role public.role_type NOT NULL,
    recipient_role public.role_type NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view order messages" ON public.order_messages;
CREATE POLICY "Participants can view order messages" 
    ON public.order_messages FOR SELECT 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.orders 
            WHERE orders.id = order_messages.order_id 
              AND (
                orders.customer_id = auth.uid() 
                OR orders.seller_id = auth.uid() 
                OR orders.delivery_partner_id = auth.uid()
              )
        )
    );

DROP POLICY IF EXISTS "Participants can send messages" ON public.order_messages;
CREATE POLICY "Participants can send messages" 
    ON public.order_messages FOR INSERT 
    TO authenticated 
    WITH CHECK (
        sender_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.orders 
            WHERE orders.id = order_messages.order_id 
              AND (
                orders.customer_id = auth.uid() 
                OR orders.seller_id = auth.uid() 
                OR orders.delivery_partner_id = auth.uid()
              )
        )
    );

-- 9. Storage Buckets Setup
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT TO public USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Sellers can upload images" ON storage.objects;
CREATE POLICY "Sellers can upload images" ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (
  bucket_id = 'product-images' 
  AND (owner = auth.uid() OR auth.uid()::text = (regexp_split_to_array(name, '/'))[1])
);

DROP POLICY IF EXISTS "Sellers can update images" ON storage.objects;
CREATE POLICY "Sellers can update images" ON storage.objects FOR UPDATE TO authenticated 
WITH CHECK (
  bucket_id = 'product-images' 
  AND (owner = auth.uid() OR auth.uid()::text = (regexp_split_to_array(name, '/'))[1])
);

DROP POLICY IF EXISTS "Sellers can delete images" ON storage.objects;
CREATE POLICY "Sellers can delete images" ON storage.objects FOR DELETE TO authenticated 
USING (
  bucket_id = 'product-images' 
  AND (owner = auth.uid() OR auth.uid()::text = (regexp_split_to_array(name, '/'))[1])
);

INSERT INTO storage.buckets (id, name, public) 
VALUES ('profiles', 'profiles', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Profiles Access" ON storage.objects;
CREATE POLICY "Public Profiles Access" ON storage.objects FOR SELECT TO public USING (bucket_id = 'profiles');

DROP POLICY IF EXISTS "Users can manage their profile photos" ON storage.objects;
CREATE POLICY "Users can manage their profile photos" ON storage.objects FOR ALL TO authenticated 
WITH CHECK (
  bucket_id = 'profiles' 
  AND (owner = auth.uid() OR auth.uid()::text = (regexp_split_to_array(name, '/'))[1])
);

-- 10. Update handle_new_user to be robust and support conflict resolutions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    assigned_role public.role_type;
    full_name_val TEXT;
BEGIN
    -- Extract and validate user role from metadata, default to 'customer'
    IF (new.raw_user_meta_data->>'role') = 'seller' THEN
        assigned_role := 'seller'::public.role_type;
    ELSIF (new.raw_user_meta_data->>'role') = 'delivery' THEN
        assigned_role := 'delivery'::public.role_type;
    ELSIF (new.raw_user_meta_data->>'role') = 'admin' THEN
        assigned_role := 'admin'::public.role_type;
    ELSE
        assigned_role := 'customer'::public.role_type;
    END IF;

    -- Extract full name from raw metadata
    full_name_val := COALESCE(
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'name',
        'User'
    );

    INSERT INTO public.profiles (id, role, full_name, phone_number, avatar_url)
    VALUES (
        new.id,
        assigned_role,
        full_name_val,
        COALESCE(new.phone, new.raw_user_meta_data->>'phone_number'),
        new.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO UPDATE
    SET role = EXCLUDED.role,
        full_name = EXCLUDED.full_name,
        phone_number = EXCLUDED.phone_number,
        avatar_url = EXCLUDED.avatar_url;

    -- If the user registers as a delivery partner, auto-initialize the status record
    IF assigned_role = 'delivery' THEN
        INSERT INTO public.delivery_partners (id, is_online)
        VALUES (new.id, false)
        ON CONFLICT (id) DO NOTHING;
    END IF;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Profile Insert Policy
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" 
    ON public.profiles FOR INSERT 
    TO authenticated 
    WITH CHECK (auth.uid() = id);

-- 12. Create Driver Assign Trigger Function (Seller Accepting Order)
CREATE OR REPLACE FUNCTION public.trigger_assign_driver()
RETURNS TRIGGER AS $$
DECLARE
    nearest_driver_id UUID;
    seller_loc public.geography(Point, 4326);
BEGIN
    IF (NEW.status = 'accepted' OR NEW.status = 'awaiting_pickup') AND NEW.delivery_partner_id IS NULL THEN
        SELECT location INTO seller_loc FROM public.sellers WHERE id = NEW.seller_id;
        
        IF seller_loc IS NOT NULL THEN
            -- Find closest online driver who is NOT currently busy with an active order
            SELECT dp.id INTO nearest_driver_id
            FROM public.delivery_partners dp
            WHERE dp.is_online = true
              AND NOT EXISTS (
                  SELECT 1 FROM public.orders o 
                  WHERE o.delivery_partner_id = dp.id 
                    AND o.status NOT IN ('delivered', 'cancelled')
              )
              AND ST_DWithin(dp.location, seller_loc, 10000)
            ORDER BY ST_Distance(dp.location, seller_loc) ASC
            LIMIT 1;

            -- Fallback
            IF nearest_driver_id IS NULL THEN
                SELECT dp.id INTO nearest_driver_id
                FROM public.delivery_partners dp
                WHERE dp.is_online = true
                  AND NOT EXISTS (
                      SELECT 1 FROM public.orders o 
                      WHERE o.delivery_partner_id = dp.id 
                        AND o.status NOT IN ('delivered', 'cancelled')
                  )
                ORDER BY ST_Distance(dp.location, seller_loc) ASC
                LIMIT 1;
            END IF;

            IF nearest_driver_id IS NOT NULL THEN
                NEW.delivery_partner_id := nearest_driver_id;
                
                INSERT INTO public.delivery_logs (order_id, delivery_partner_id, status, location)
                VALUES (NEW.id, nearest_driver_id, 'assigned', (SELECT location FROM public.delivery_partners WHERE id = nearest_driver_id));
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_order_status_awaiting_pickup ON public.orders;
CREATE TRIGGER on_order_status_awaiting_pickup
    BEFORE UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_assign_driver();

-- 13. Create Driver Online Auto-Assignment Trigger Function
CREATE OR REPLACE FUNCTION public.trigger_assign_pending_orders()
RETURNS TRIGGER AS $$
DECLARE
    pending_order RECORD;
    nearest_driver_id UUID;
    seller_loc public.geography(Point, 4326);
BEGIN
    IF NEW.is_online = true AND (OLD.is_online = false OR OLD.is_online IS NULL) THEN
        FOR pending_order IN 
            SELECT id, seller_id FROM public.orders 
            WHERE status IN ('accepted', 'preparing', 'awaiting_pickup') 
              AND delivery_partner_id IS NULL
        LOOP
            SELECT location INTO seller_loc FROM public.sellers WHERE id = pending_order.seller_id;
            
            IF seller_loc IS NOT NULL THEN
                -- Find closest online driver who is NOT currently busy with an active order
                SELECT dp.id INTO nearest_driver_id
                FROM public.delivery_partners dp
                WHERE dp.is_online = true
                  AND NOT EXISTS (
                      SELECT 1 FROM public.orders o 
                      WHERE o.delivery_partner_id = dp.id 
                        AND o.status NOT IN ('delivered', 'cancelled')
                  )
                  AND ST_DWithin(dp.location, seller_loc, 10000)
                ORDER BY ST_Distance(dp.location, seller_loc) ASC
                LIMIT 1;

                -- Fallback
                IF nearest_driver_id IS NULL THEN
                    SELECT dp.id INTO nearest_driver_id
                    FROM public.delivery_partners dp
                    WHERE dp.is_online = true
                      AND NOT EXISTS (
                          SELECT 1 FROM public.orders o 
                          WHERE o.delivery_partner_id = dp.id 
                            AND o.status NOT IN ('delivered', 'cancelled')
                      )
                    ORDER BY ST_Distance(dp.location, seller_loc) ASC
                    LIMIT 1;
                END IF;

                IF nearest_driver_id IS NOT NULL THEN
                    UPDATE public.orders 
                    SET delivery_partner_id = nearest_driver_id,
                        updated_at = now()
                    WHERE id = pending_order.id;

                    INSERT INTO public.delivery_logs (order_id, delivery_partner_id, status, location)
                    VALUES (pending_order.id, nearest_driver_id, 'assigned', (SELECT location FROM public.delivery_partners WHERE id = nearest_driver_id));
                END IF;
            END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_driver_online_assign ON public.delivery_partners;
CREATE TRIGGER on_driver_online_assign
    AFTER INSERT OR UPDATE ON public.delivery_partners
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_assign_pending_orders();

-- 14. Create trigger function to handle payout distribution upon order delivery
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

DROP TRIGGER IF EXISTS on_order_delivered ON public.orders;
CREATE TRIGGER on_order_delivered
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_order_delivery_payout();

-- 15. Enable Supabase Realtime Publication for ALL Tables
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR ALL TABLES;

-- 16. Add INSERT RLS policy for order_items to allow customers to insert items under their own orders
DROP POLICY IF EXISTS "Customers can insert their order items" ON public.order_items;
CREATE POLICY "Customers can insert their order items" 
    ON public.order_items FOR INSERT 
    TO authenticated 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.orders 
            WHERE orders.id = order_items.order_id 
              AND orders.customer_id = auth.uid()
        )
    );

-- 17. Relax INSERT policy on public.orders to allow any authenticated user to create an order as customer
DROP POLICY IF EXISTS "Customers can create orders" ON public.orders;
CREATE POLICY "Customers can create orders" 
    ON public.orders FOR INSERT 
    TO authenticated 
    WITH CHECK (
        customer_id = auth.uid()
    );
