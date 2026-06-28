-- Migration: Exclude busy drivers from order auto-assignment and allow sellers/customers to insert delivery logs

-- 1. Update trigger_assign_driver function to exclude busy drivers
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


-- 2. Update trigger_assign_pending_orders function to exclude busy drivers
CREATE OR REPLACE FUNCTION public.trigger_assign_pending_orders()
RETURNS TRIGGER AS $$
DECLARE
    pending_order RECORD;
    nearest_driver_id UUID;
    seller_loc public.geography(Point, 4326);
BEGIN
    -- Only run if the driver just went online
    IF NEW.is_online = true AND (OLD.is_online = false OR OLD.is_online IS NULL) THEN
        -- Find all active orders without a delivery partner
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


-- 3. Update RLS policy for delivery_logs to allow orders' customer and seller to submit logs
DROP POLICY IF EXISTS "Delivery partner can submit logs" ON public.delivery_logs;
CREATE POLICY "Delivery partner can submit logs" 
    ON public.delivery_logs FOR INSERT 
    TO authenticated 
    WITH CHECK (
        delivery_partner_id = auth.uid() 
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'delivery'
        )
        OR EXISTS (
            SELECT 1 FROM public.orders 
            WHERE orders.id = order_id 
              AND (orders.customer_id = auth.uid() OR orders.seller_id = auth.uid())
        )
    );


-- 4. Add INSERT RLS policy for order_items to allow customers to insert items under their own orders
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


-- 5. Relax INSERT policy on public.orders to allow any authenticated user to create an order as customer
DROP POLICY IF EXISTS "Customers can create orders" ON public.orders;
CREATE POLICY "Customers can create orders" 
    ON public.orders FOR INSERT 
    TO authenticated 
    WITH CHECK (
        customer_id = auth.uid()
    );
