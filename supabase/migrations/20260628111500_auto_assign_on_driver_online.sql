-- Migration: Auto-assign pending orders when a driver turns online
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
            -- Fetch store location
            SELECT location INTO seller_loc FROM public.sellers WHERE id = pending_order.seller_id;
            
            IF seller_loc IS NOT NULL THEN
                -- Find closest online driver
                SELECT dp.id INTO nearest_driver_id
                FROM public.delivery_partners dp
                WHERE dp.is_online = true
                  AND ST_DWithin(dp.location, seller_loc, 10000)
                ORDER BY ST_Distance(dp.location, seller_loc) ASC
                LIMIT 1;

                -- Fallback if no online rider is within 10km of the store
                IF nearest_driver_id IS NULL THEN
                    SELECT dp.id INTO nearest_driver_id
                    FROM public.delivery_partners dp
                    WHERE dp.is_online = true
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
    AFTER UPDATE OF is_online ON public.delivery_partners
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_assign_pending_orders();
