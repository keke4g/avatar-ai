-- migration_rls_fixes.sql
-- 1. Make sender_id nullable in public.messages to support system/moderation alerts without UUID profiles references
ALTER TABLE public.messages ALTER COLUMN sender_id DROP NOT NULL;

-- 2. Drop old message RLS policy and establish correct insert permissions
DROP POLICY IF EXISTS "Users can send swap messages" ON public.messages;

CREATE POLICY "Users can send swap messages" ON public.messages FOR INSERT WITH CHECK (
  (sender_id IS NULL OR auth.uid() = sender_id) AND EXISTS (
    SELECT 1 FROM public.swaps 
    WHERE id = swap_id AND (sender_id = auth.uid() OR receiver_id = auth.uid())
  )
);

-- 3. Drop old notifications RLS policy and split permissions (read/write only owner, insert any authenticated party)
DROP POLICY IF EXISTS "Users can manage their notifications" ON public.notifications;

CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING (
  auth.uid() = user_id
);

CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING (
  auth.uid() = user_id
);

CREATE POLICY "Users can delete their own notifications" ON public.notifications FOR DELETE USING (
  auth.uid() = user_id
);

CREATE POLICY "Authenticated users can insert notifications" ON public.notifications FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);
