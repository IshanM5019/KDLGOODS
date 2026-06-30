-- Migration: Add explicit latitude and longitude columns to delivery_partners for Realtime updates
alter table public.delivery_partners 
add column if not exists latitude double precision,
add column if not exists longitude double precision;
