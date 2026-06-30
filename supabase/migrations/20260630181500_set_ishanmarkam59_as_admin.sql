-- Migration: Auto-assign admin role to specific administrator email
-- This handles existing profiles and updates the trigger function for new signups.

-- 1. Update existing user if they have already registered
UPDATE public.profiles
SET role = 'admin'
WHERE id IN (
  SELECT id FROM auth.users 
  WHERE email = 'ishanmarkam59@gmail.com'
);

-- 2. Update trigger to catch the email on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    assigned_role TEXT;
    full_name_val TEXT;
BEGIN
    IF new.email = 'ishanmarkam59@gmail.com' THEN
        assigned_role := 'admin';
    ELSE
        assigned_role := COALESCE(
            new.raw_user_meta_data->>'role',
            'customer'
        );
    END IF;

    full_name_val := COALESCE(
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'name',
        'User'
    );

    -- Try to insert with correct cast (handles custom PostgreSQL enum variations)
    BEGIN
        INSERT INTO public.profiles (id, role, full_name, phone_number, avatar_url)
        VALUES (
            new.id,
            assigned_role::public.role_type,
            full_name_val,
            COALESCE(new.phone, new.raw_user_meta_data->>'phone_number'),
            new.raw_user_meta_data->>'avatar_url'
        )
        ON CONFLICT (id) DO UPDATE
        SET role = EXCLUDED.role,
            full_name = EXCLUDED.full_name,
            phone_number = EXCLUDED.phone_number,
            avatar_url = EXCLUDED.avatar_url;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO public.profiles (id, role, full_name, phone_number, avatar_url)
        VALUES (
            new.id,
            assigned_role::public.user_role,
            full_name_val,
            COALESCE(new.phone, new.raw_user_meta_data->>'phone_number'),
            new.raw_user_meta_data->>'avatar_url'
        )
        ON CONFLICT (id) DO UPDATE
        SET role = EXCLUDED.role,
            full_name = EXCLUDED.full_name,
            phone_number = EXCLUDED.phone_number,
            avatar_url = EXCLUDED.avatar_url;
    END;

    -- If the user registers as a delivery partner, auto-initialize the status record
    IF assigned_role = 'delivery' THEN
        INSERT INTO public.delivery_partners (id, is_online)
        VALUES (new.id, false)
        ON CONFLICT (id) DO NOTHING;
    END IF;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
