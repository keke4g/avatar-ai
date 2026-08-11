-- =========================================================================
-- AuraSwap SQL Migration — Fase 4H: Reviews & Reputation System
-- =========================================================================
-- Execute this script inside the Supabase SQL Editor to provision
-- the database rules, constraints, triggers, and relational schemas.
-- =========================================================================

-- 1. DROP THE OLD REVIEWS TABLE & ALL ITS POLICIES
DROP TABLE IF EXISTS public.reviews CASCADE;

-- 2. UPDATE swaps TABLE FOR COMPLETED LIFECYCLE & MUTUAL CHECKS
-- Drop the existing inline check constraint (usually named swaps_status_check or checks)
ALTER TABLE public.swaps DROP CONSTRAINT IF EXISTS swaps_status_check;
ALTER TABLE public.swaps DROP CONSTRAINT IF EXISTS check_swaps_status;

-- Add updated check constraint to support CONFIRMED, ACTIVE and COMPLETED statuses
ALTER TABLE public.swaps ADD CONSTRAINT check_swaps_status 
  CHECK (status IN ('PENDING', 'APPROVED', 'DECLINED', 'CONFIRMED', 'ACTIVE', 'COMPLETED'));

-- Add columns to track completion confirmation from each swap participant
ALTER TABLE public.swaps ADD COLUMN IF NOT EXISTS sender_confirmed_complete boolean NOT NULL DEFAULT false;
ALTER TABLE public.swaps ADD COLUMN IF NOT EXISTS receiver_confirmed_complete boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.swaps.status IS 'Status of the swap request: PENDING, APPROVED, DECLINED, CONFIRMED, ACTIVE, COMPLETED';
COMMENT ON COLUMN public.swaps.sender_confirmed_complete IS 'Tracks whether the sender confirmed checkout and completed trip';
COMMENT ON COLUMN public.swaps.receiver_confirmed_complete IS 'Tracks whether the receiver confirmed checkout and completed trip';


-- 3. CREATE THE NEW SECURE, NORMALIZED REVIEWS TABLE
CREATE TABLE public.reviews (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  swap_id uuid REFERENCES public.swaps(id) ON DELETE CASCADE NOT NULL,
  reviewer_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  reviewed_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text NOT NULL CHECK (length(trim(comment)) > 0),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Structural Integrity Business Rules
  CONSTRAINT unique_reviewer_swap UNIQUE (swap_id, reviewer_id),
  CONSTRAINT check_not_self_review CHECK (reviewer_id <> reviewed_user_id)
);

COMMENT ON TABLE public.reviews IS 'Verified review records made by hosts about each other after COMPLETED swaps';
COMMENT ON COLUMN public.reviews.swap_id IS 'Junction swap reference that authorizes this review';
COMMENT ON COLUMN public.reviews.reviewer_id IS 'Profile reference of the member writing this review';
COMMENT ON COLUMN public.reviews.reviewed_user_id IS 'Profile reference of the member receiving this review';


-- 4. CREATE PRE-INSERT VALIDITY TRIGGER
-- Enforces that review author and target are correct, and status is COMPLETED
CREATE OR REPLACE FUNCTION public.check_review_validity()
RETURNS trigger AS $$
declare
  swap_record record;
begin
  -- Fetch the swap details
  select * into swap_record from public.swaps where id = new.swap_id;
  
  if not found then
    raise exception 'El intercambio especificado no existe.';
  end if;
  
  -- Verify the status is COMPLETED
  if swap_record.status <> 'COMPLETED' then
    raise exception 'Solo se pueden dejar reseñas en intercambios completados.';
  end if;
  
  -- Verify the reviewer is a participant in the swap
  if new.reviewer_id <> swap_record.sender_id and new.reviewer_id <> swap_record.receiver_id then
    raise exception 'El autor de la reseña debe ser participante del intercambio.';
  end if;
  
  -- Verify the reviewed user is the OTHER participant in the swap
  if new.reviewer_id = swap_record.sender_id then
    if new.reviewed_user_id <> swap_record.receiver_id then
      raise exception 'El usuario reseñado debe ser la contraparte del intercambio.';
    end if;
  else
    if new.reviewed_user_id <> swap_record.sender_id then
      raise exception 'El usuario reseñado debe ser la contraparte del intercambio.';
    end if;
  end if;
  
  return new;
end;
$$ language plpgsql;

CREATE TRIGGER verify_review_before_insert_trigger
  BEFORE INSERT ON public.reviews
  FOR EACH ROW EXECUTE PROCEDURE public.check_review_validity();

COMMENT ON FUNCTION public.check_review_validity() IS 'Trigger function to validate reviewer, reviewed user, and swap status boundaries';


-- 5. ENABLE ROW-LEVEL SECURITY & DEFINE IMMUTABLE REVIEW POLICIES
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- SELECT: Public readable
CREATE POLICY "Reviews are public readable" 
  ON public.reviews FOR SELECT USING (true);

-- INSERT: Authenticated swap participants can insert their own reviews
CREATE POLICY "Swap participants can insert reviews" 
  ON public.reviews FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND auth.uid() = reviewer_id
  );

-- UPDATE: Only system administrators can update reviews (100% Immutable for standard users)
CREATE POLICY "Admins can update reviews" 
  ON public.reviews FOR UPDATE USING (
    public.is_admin(auth.uid())
  );

-- DELETE: Only system administrators can delete reviews
CREATE POLICY "Admins can delete reviews" 
  ON public.reviews FOR DELETE USING (
    public.is_admin(auth.uid())
  );

-- Create a helper index for querying reviews by reviewed user
CREATE INDEX IF NOT EXISTS idx_reviews_reviewed_user ON public.reviews(reviewed_user_id);
