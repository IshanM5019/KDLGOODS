-- Add new statuses to order_status enum for granular delivery tracking
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'driver_accepted';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'picked_up';
