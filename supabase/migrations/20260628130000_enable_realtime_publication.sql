-- Migration: Enable Supabase Realtime publication for all tables to ensure event delivery
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR ALL TABLES;
