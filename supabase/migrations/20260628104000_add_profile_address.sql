-- Migration: Add address field to user profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address TEXT;
