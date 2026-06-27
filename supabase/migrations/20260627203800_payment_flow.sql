-- Migration: Add custom payment details and driver cash submission fields to orders
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'cod',
ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS upi_transaction_id TEXT,
ADD COLUMN IF NOT EXISTS upi_screenshot_url TEXT,
ADD COLUMN IF NOT EXISTS driver_cash_submitted BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS driver_cash_txn_id TEXT,
ADD COLUMN IF NOT EXISTS driver_cash_screenshot_url TEXT;

-- Enforce valid options
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS check_payment_method;
ALTER TABLE public.orders ADD CONSTRAINT check_payment_method CHECK (payment_method IN ('cod', 'upi'));

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS check_payment_status;
ALTER TABLE public.orders ADD CONSTRAINT check_payment_status CHECK (payment_status IN ('pending', 'paid'));

-- Update handle_new_user to fallback to raw_user_meta_data->>'phone_number' if new.phone is null
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    assigned_role public.user_role;
    full_name_val TEXT;
BEGIN
    assigned_role := COALESCE(
        (new.raw_user_meta_data->>'role')::public.user_role,
        'customer'::public.user_role
    );

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
