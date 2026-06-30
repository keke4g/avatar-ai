-- =========================================================================
-- AuraSwap Realtime Replication Aprovisioning
-- =========================================================================
-- Execute this script inside the Supabase SQL Editor to enable Realtime
-- streaming for messages, notifications, and swaps tables.
-- =========================================================================

-- 1. Enable Realtime for public.messages
alter publication supabase_realtime add table public.messages;

-- 2. Enable Realtime for public.notifications
alter publication supabase_realtime add table public.notifications;

-- 3. Enable Realtime for public.swaps
alter publication supabase_realtime add table public.swaps;

COMMENT ON TABLE public.messages IS 'Table registered in Supabase Realtime for instant peer-to-peer chats';
COMMENT ON TABLE public.notifications IS 'Table registered in Supabase Realtime for instant platform alerts';
COMMENT ON TABLE public.swaps IS 'Table registered in Supabase Realtime for instant agreement state updates';
