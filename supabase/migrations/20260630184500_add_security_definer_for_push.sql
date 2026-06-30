-- Migration: Add security definer function to retrieve push subscriptions
-- This bypasses client RLS to allow the API route to fetch subscriber tokens.

CREATE OR REPLACE FUNCTION public.get_user_push_subscriptions(target_user_id UUID)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    endpoint TEXT,
    p256dh TEXT,
    auth TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY 
    SELECT s.id, s.user_id, s.endpoint, s.p256dh, s.auth, s.created_at
    FROM public.push_subscriptions s
    WHERE s.user_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to public/anon for API server-side execution
GRANT EXECUTE ON FUNCTION public.get_user_push_subscriptions(UUID) TO public;
GRANT EXECUTE ON FUNCTION public.get_user_push_subscriptions(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_user_push_subscriptions(UUID) TO authenticated;
