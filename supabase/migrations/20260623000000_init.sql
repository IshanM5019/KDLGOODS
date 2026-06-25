-- Enable PostGIS extension for spatial index queries
CREATE EXTENSION IF NOT EXISTS postgis SCHEMA public;

-- Enums setup
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_type') THEN
        CREATE TYPE public.role_type AS ENUM ('customer', 'seller', 'delivery', 'admin');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
        CREATE TYPE public.order_status AS ENUM ('placed', 'accepted', 'preparing', 'awaiting_pickup', 'out_for_delivery', 'delivered', 'cancelled');
    END IF;
END$$;

-- Ensure missing enum values are added if enums were pre-created
ALTER TYPE public.role_type ADD VALUE IF NOT EXISTS 'customer';
ALTER TYPE public.role_type ADD VALUE IF NOT EXISTS 'seller';
ALTER TYPE public.role_type ADD VALUE IF NOT EXISTS 'delivery';
ALTER TYPE public.role_type ADD VALUE IF NOT EXISTS 'admin';


-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.role_type NOT NULL DEFAULT 'customer',
    full_name TEXT NOT NULL,
    phone_number TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure pre-existing profiles table has all necessary columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role public.role_type NOT NULL DEFAULT 'customer';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT NOT NULL DEFAULT 'User';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();


-- 2. Sellers Table
CREATE TABLE IF NOT EXISTS public.sellers (
    id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    store_name TEXT NOT NULL,
    description TEXT,
    address TEXT NOT NULL,
    location public.geography(Point, 4326) NOT NULL,
    geohash VARCHAR(12),
    is_active BOOLEAN NOT NULL DEFAULT true,
    banner_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Delivery Partners Table
CREATE TABLE IF NOT EXISTS public.delivery_partners (
    id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_online BOOLEAN NOT NULL DEFAULT false,
    location public.geography(Point, 4326),
    geohash VARCHAR(12),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Products Table
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10,2) NOT NULL CHECK (price > 0),
    image_url TEXT,
    category TEXT NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT true,
    is_ready_for_30min BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Carts Table
CREATE TABLE IF NOT EXISTS public.carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Cart Items Table
CREATE TABLE IF NOT EXISTS public.cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id UUID NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_cart_product UNIQUE (cart_id, product_id)
);

-- 7. Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE RESTRICT,
    delivery_partner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status public.order_status NOT NULL DEFAULT 'placed',
    total_amount NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
    delivery_address TEXT NOT NULL,
    delivery_location public.geography(Point, 4326) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Order Items Table
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price_at_order NUMERIC(10,2) NOT NULL CHECK (price_at_order >= 0)
);

-- 9. Delivery Logs Table (Real-time tracking)
CREATE TABLE IF NOT EXISTS public.delivery_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    delivery_partner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status TEXT NOT NULL,
    location public.geography(Point, 4326),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row-Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_logs ENABLE ROW LEVEL SECURITY;

-- Spatial GIST Indexing for Geolocation Queries
CREATE INDEX IF NOT EXISTS sellers_location_gist ON public.sellers USING gist (location);
CREATE INDEX IF NOT EXISTS delivery_partners_location_gist ON public.delivery_partners USING gist (location);
CREATE INDEX IF NOT EXISTS orders_delivery_location_gist ON public.orders USING gist (delivery_location);
CREATE INDEX IF NOT EXISTS delivery_logs_location_gist ON public.delivery_logs USING gist (location);

-- Triggers: Automatically set updated_at column
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS handle_updated_at_profiles ON public.profiles;
CREATE TRIGGER handle_updated_at_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS handle_updated_at_sellers ON public.sellers;
CREATE TRIGGER handle_updated_at_sellers BEFORE UPDATE ON public.sellers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS handle_updated_at_delivery_partners ON public.delivery_partners;
CREATE TRIGGER handle_updated_at_delivery_partners BEFORE UPDATE ON public.delivery_partners FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS handle_updated_at_products ON public.products;
CREATE TRIGGER handle_updated_at_products BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS handle_updated_at_carts ON public.carts;
CREATE TRIGGER handle_updated_at_carts BEFORE UPDATE ON public.carts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS handle_updated_at_orders ON public.orders;
CREATE TRIGGER handle_updated_at_orders BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: Automatically generate geohash from location geometry on insertion/modification
CREATE OR REPLACE FUNCTION public.sync_seller_geohash()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.location IS NOT NULL THEN
        -- ST_GeoHash takes a geometry inside EPSG:4326, we cast geography to geometry
        NEW.geohash := ST_GeoHash(NEW.location::geometry, 9);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS handle_seller_geohash ON public.sellers;
CREATE TRIGGER handle_seller_geohash BEFORE INSERT OR UPDATE OF location ON public.sellers FOR EACH ROW EXECUTE FUNCTION public.sync_seller_geohash();

DROP TRIGGER IF EXISTS handle_delivery_partner_geohash ON public.delivery_partners;
CREATE TRIGGER handle_delivery_partner_geohash BEFORE INSERT OR UPDATE OF location ON public.delivery_partners FOR EACH ROW EXECUTE FUNCTION public.sync_seller_geohash();

-- Trigger: Insert a profile when a new user signs up in Supabase Auth
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
        new.phone,
        new.raw_user_meta_data->>'avatar_url'
    );

    -- If the user registers as a delivery partner, auto-initialize the status record
    IF assigned_role = 'delivery' THEN
        INSERT INTO public.delivery_partners (id, is_online)
        VALUES (new.id, false);
    END IF;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- High-Performance Radius Search RPC for hyper-local storefront matching (5km SLA)
CREATE OR REPLACE FUNCTION public.get_nearby_sellers(
    customer_lat DOUBLE PRECISION,
    customer_lng DOUBLE PRECISION,
    max_distance_meters DOUBLE PRECISION DEFAULT 5000
)
RETURNS TABLE (
    id UUID,
    store_name TEXT,
    description TEXT,
    address TEXT,
    location public.geography(Point, 4326),
    geohash VARCHAR(12),
    banner_url TEXT,
    distance_meters DOUBLE PRECISION
) AS $$
DECLARE
    customer_geom public.geography(Point, 4326);
BEGIN
    customer_geom := ST_SetSRID(ST_MakePoint(customer_lng, customer_lat), 4326)::public.geography;
    RETURN QUERY
    SELECT 
        s.id,
        s.store_name,
        s.description,
        s.address,
        s.location,
        s.geohash,
        s.banner_url,
        ST_Distance(s.location, customer_geom) AS distance_meters
    FROM public.sellers s
    WHERE s.is_active = true
      AND ST_DWithin(s.location, customer_geom, max_distance_meters)
    ORDER BY distance_meters ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Transactional Order State Dispatch RPC: Finds nearest online delivery partner to store
CREATE OR REPLACE FUNCTION public.assign_nearest_driver(order_uuid UUID)
RETURNS UUID AS $$
DECLARE
    nearest_driver_id UUID;
    seller_loc public.geography(Point, 4326);
    order_status_val public.order_status;
BEGIN
    -- Check order status
    SELECT status INTO order_status_val FROM public.orders WHERE id = order_uuid;
    IF order_status_val != 'awaiting_pickup' THEN
        RETURN NULL;
    END IF;

    -- Fetch store coordinate
    SELECT s.location INTO seller_loc 
    FROM public.orders o
    JOIN public.sellers s ON s.id = o.seller_id
    WHERE o.id = order_uuid;

    IF seller_loc IS NOT NULL THEN
        -- Find closest online driver within 10km (10000m)
        SELECT dp.id INTO nearest_driver_id
        FROM public.delivery_partners dp
        WHERE dp.is_online = true
          AND ST_DWithin(dp.location, seller_loc, 10000)
        ORDER BY ST_Distance(dp.location, seller_loc) ASC
        LIMIT 1;

        IF nearest_driver_id IS NOT NULL THEN
            UPDATE public.orders
            SET delivery_partner_id = nearest_driver_id,
                updated_at = now()
            WHERE id = order_uuid;

            -- Log assignment update
            INSERT INTO public.delivery_logs (order_id, delivery_partner_id, status, location)
            VALUES (order_uuid, nearest_driver_id, 'assigned', (SELECT location FROM public.delivery_partners WHERE id = nearest_driver_id));
            
            RETURN nearest_driver_id;
        END IF;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Automatically trigger driver assignment when status goes to accepted or awaiting_pickup
CREATE OR REPLACE FUNCTION public.trigger_assign_driver()
RETURNS TRIGGER AS $$
DECLARE
    nearest_driver_id UUID;
    seller_loc public.geography(Point, 4326);
BEGIN
    IF (NEW.status = 'accepted' OR NEW.status = 'awaiting_pickup') AND NEW.delivery_partner_id IS NULL THEN
        SELECT location INTO seller_loc FROM public.sellers WHERE id = NEW.seller_id;
        
        IF seller_loc IS NOT NULL THEN
            SELECT dp.id INTO nearest_driver_id
            FROM public.delivery_partners dp
            WHERE dp.is_online = true
              AND ST_DWithin(dp.location, seller_loc, 10000)
            ORDER BY ST_Distance(dp.location, seller_loc) ASC
            LIMIT 1;

            -- Developer/Remote testing fallback: if no online rider is within 10km of the store, assign the nearest online rider regardless of distance
            IF nearest_driver_id IS NULL THEN
                SELECT dp.id INTO nearest_driver_id
                FROM public.delivery_partners dp
                WHERE dp.is_online = true
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

--------------------------------------------------------------------------------
-- ROW-LEVEL SECURITY POLICIES
--------------------------------------------------------------------------------

-- 1. Profiles Policies
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles are viewable by authenticated users" 
    ON public.profiles FOR SELECT 
    TO authenticated 
    USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" 
    ON public.profiles FOR UPDATE 
    TO authenticated 
    USING (auth.uid() = id);

-- 2. Sellers Policies
DROP POLICY IF EXISTS "Sellers viewable by authenticated users" ON public.sellers;
CREATE POLICY "Sellers viewable by authenticated users" 
    ON public.sellers FOR SELECT 
    TO authenticated 
    USING (true);

DROP POLICY IF EXISTS "Sellers can register their own profile" ON public.sellers;
CREATE POLICY "Sellers can register their own profile" 
    ON public.sellers FOR INSERT 
    TO authenticated 
    WITH CHECK (
        auth.uid() = id 
        AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'seller'
        )
    );

DROP POLICY IF EXISTS "Sellers can update their own store details" ON public.sellers;
CREATE POLICY "Sellers can update their own store details" 
    ON public.sellers FOR UPDATE 
    TO authenticated 
    USING (auth.uid() = id);

-- 3. Delivery Partners Policies
DROP POLICY IF EXISTS "Delivery partners viewable by authenticated users" ON public.delivery_partners;
CREATE POLICY "Delivery partners viewable by authenticated users"
    ON public.delivery_partners FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Delivery partners can update their own status" ON public.delivery_partners;
CREATE POLICY "Delivery partners can update their own status"
    ON public.delivery_partners FOR ALL
    TO authenticated
    USING (auth.uid() = id);

-- 4. Products Policies
DROP POLICY IF EXISTS "Products viewable by authenticated users" ON public.products;
CREATE POLICY "Products viewable by authenticated users" 
    ON public.products FOR SELECT 
    TO authenticated 
    USING (is_available = true OR seller_id = auth.uid());

DROP POLICY IF EXISTS "Sellers can manage their products" ON public.products;
CREATE POLICY "Sellers can manage their products" 
    ON public.products FOR ALL 
    TO authenticated 
    USING (
        seller_id = auth.uid() 
        AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'seller'
        )
    );

-- 5. Carts Policies
DROP POLICY IF EXISTS "Users can access their own cart" ON public.carts;
CREATE POLICY "Users can access their own cart" 
    ON public.carts FOR ALL 
    TO authenticated 
    USING (user_id = auth.uid());

-- 6. Cart Items Policies
DROP POLICY IF EXISTS "Users can manage their cart items" ON public.cart_items;
CREATE POLICY "Users can manage their cart items" 
    ON public.cart_items FOR ALL 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.carts 
            WHERE carts.id = cart_items.cart_id AND carts.user_id = auth.uid()
        )
    );

-- 7. Orders Policies
DROP POLICY IF EXISTS "Users can view their orders" ON public.orders;
CREATE POLICY "Users can view their orders" 
    ON public.orders FOR SELECT 
    TO authenticated 
    USING (
        customer_id = auth.uid() 
        OR seller_id = auth.uid() 
        OR delivery_partner_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'delivery'
        )
    );

DROP POLICY IF EXISTS "Customers can create orders" ON public.orders;
CREATE POLICY "Customers can create orders" 
    ON public.orders FOR INSERT 
    TO authenticated 
    WITH CHECK (
        customer_id = auth.uid() 
        AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'customer'
        )
    );

DROP POLICY IF EXISTS "Authorized members can update orders" ON public.orders;
CREATE POLICY "Authorized members can update orders" 
    ON public.orders FOR UPDATE 
    TO authenticated 
    USING (
        customer_id = auth.uid() 
        OR seller_id = auth.uid() 
        OR delivery_partner_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'delivery'
        )
    );

-- 8. Order Items Policies
DROP POLICY IF EXISTS "Users can view their order items" ON public.order_items;
CREATE POLICY "Users can view their order items" 
    ON public.order_items FOR SELECT 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.orders 
            WHERE orders.id = order_items.order_id 
              AND (
                orders.customer_id = auth.uid() 
                OR orders.seller_id = auth.uid() 
                OR orders.delivery_partner_id = auth.uid()
              )
        )
    );

-- 9. Delivery Logs Policies
DROP POLICY IF EXISTS "Authorized user types can view delivery logs" ON public.delivery_logs;
CREATE POLICY "Authorized user types can view delivery logs" 
    ON public.delivery_logs FOR SELECT 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.orders 
            WHERE orders.id = delivery_logs.order_id 
              AND (
                orders.customer_id = auth.uid() 
                OR orders.seller_id = auth.uid() 
                OR orders.delivery_partner_id = auth.uid()
              )
        )
    );

DROP POLICY IF EXISTS "Delivery partner can submit logs" ON public.delivery_logs;
CREATE POLICY "Delivery partner can submit logs" 
    ON public.delivery_logs FOR INSERT 
    TO authenticated 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'delivery'
        )
    );

-- 10. Enable Supabase Realtime for Realtime Event Notifications
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_rel pr 
            JOIN pg_class c ON pr.prrelid = c.oid 
            JOIN pg_publication p ON pr.prpubid = p.oid 
            WHERE p.pubname = 'supabase_realtime' AND c.relname = 'orders'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_rel pr 
            JOIN pg_class c ON pr.prrelid = c.oid 
            JOIN pg_publication p ON pr.prpubid = p.oid 
            WHERE p.pubname = 'supabase_realtime' AND c.relname = 'delivery_partners'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_partners;
        END IF;
    END IF;
END$$;

