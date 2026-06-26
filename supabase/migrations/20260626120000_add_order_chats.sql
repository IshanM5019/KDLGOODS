-- Create order_messages table
CREATE TABLE IF NOT EXISTS public.order_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    sender_role public.role_type NOT NULL,
    recipient_role public.role_type, -- NULL indicates sent to all participants
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;

-- Select policy
CREATE POLICY "Order messages are viewable by participants" 
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

-- Insert policy
CREATE POLICY "Order messages can be created by participants" 
    ON public.order_messages FOR INSERT 
    TO authenticated
    WITH CHECK (
        auth.uid() = sender_id
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

-- Enable Supabase Realtime for order_messages
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_rel pr 
            JOIN pg_class c ON pr.prrelid = c.oid 
            JOIN pg_publication p ON pr.prpubid = p.oid 
            WHERE p.pubname = 'supabase_realtime' AND c.relname = 'order_messages'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.order_messages;
        END IF;
    END IF;
END$$;
