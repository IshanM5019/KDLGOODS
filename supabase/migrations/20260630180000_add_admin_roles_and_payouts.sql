-- Migration: Add payouts ledger table and admin RLS permissions
-- This setup allows admin users to manage payouts and settle balances.

-- 1. Create helper function to check if the current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create public.payouts table
CREATE TABLE IF NOT EXISTS public.payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    recipient_role TEXT NOT NULL CHECK (recipient_role IN ('seller', 'delivery')),
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cheque', 'bank_transfer', 'upi', 'cash')),
    reference_details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Enable RLS on payouts
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies for payouts
DROP POLICY IF EXISTS "Admins have full access to payouts" ON public.payouts;
CREATE POLICY "Admins have full access to payouts" 
    ON public.payouts FOR ALL 
    TO authenticated 
    USING (public.is_admin()) 
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Recipients can view their own payouts" ON public.payouts;
CREATE POLICY "Recipients can view their own payouts"
    ON public.payouts FOR SELECT
    TO authenticated
    USING (auth.uid() = recipient_id);

-- 5. Add Admin RLS Policies for other tables to permit management
DROP POLICY IF EXISTS "Admins can view and update all profiles" ON public.profiles;
CREATE POLICY "Admins can view and update all profiles"
    ON public.profiles FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can view and update all sellers" ON public.sellers;
CREATE POLICY "Admins can view and update all sellers"
    ON public.sellers FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can view and update all delivery partners" ON public.delivery_partners;
CREATE POLICY "Admins can view and update all delivery partners"
    ON public.delivery_partners FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can view and update all orders" ON public.orders;
CREATE POLICY "Admins can view and update all orders"
    ON public.orders FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
