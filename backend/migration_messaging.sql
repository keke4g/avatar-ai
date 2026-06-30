-- migration_messaging.sql
-- Injects messages.is_read support to enable live unread indicators

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS is_read boolean not null default false;

COMMENT ON COLUMN public.messages.is_read IS 'Flag to track unread chat message indicators on conversation threads';
