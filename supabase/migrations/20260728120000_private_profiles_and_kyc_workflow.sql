-- Privacy and KYC hardening.
-- This migration is intentionally idempotent so it can safely be reapplied.

-- ---------------------------------------------------------------------------
-- Profiles: private base table, explicit sanitized public projection.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

-- Remove every legacy SELECT policy, including policies whose names changed
-- between environments. Table grants are handled separately below.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and cmd = 'SELECT'
  loop
    execute format(
      'drop policy if exists %I on public.profiles',
      policy_record.policyname
    );
  end loop;
end;
$$;

create policy "Profiles are readable by owner or admin"
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or public.is_admin((select auth.uid()))
);

revoke select on table public.profiles from public, anon;
grant select on table public.profiles to authenticated;

-- A definer view is deliberate here: the view is the public DTO and exposes
-- only the listed non-sensitive fields while the base table remains private.
-- security_barrier prevents predicates supplied by a caller from being pushed
-- below the sanitizing projection.
drop view if exists public.public_profiles_view cascade;

create view public.public_profiles_view
with (security_invoker = false, security_barrier = true)
as
select
  profile.id,
  profile.name,
  profile.avatar_url,
  profile.role,
  profile.kyc_status,
  profile.is_verified,
  profile.created_at,
  profile.company_id,
  profile.office_id,
  profile.profile_type
from public.profiles profile;

revoke all on table public.public_profiles_view from public;
grant select on table public.public_profiles_view to anon, authenticated;

comment on view public.public_profiles_view is
  'Sanitized public profile DTO. Never add email, contact data, or identity document data.';

-- ---------------------------------------------------------------------------
-- KYC request metadata. Identity documents live in a private Storage bucket.
-- ---------------------------------------------------------------------------

create table if not exists public.kyc_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  object_path text not null unique,
  original_file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  status text not null default 'PENDING',
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  review_notes text,
  constraint kyc_requests_status_check
    check (status in ('PENDING', 'VERIFIED', 'REJECTED')),
  constraint kyc_requests_mime_type_check
    check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  constraint kyc_requests_size_check
    check (size_bytes > 0 and size_bytes <= 10485760),
  constraint kyc_requests_object_path_check
    check (object_path !~ '(^|/)\.\.?(/|$)'),
  constraint kyc_requests_review_state_check
    check (
      (status = 'PENDING'
        and reviewed_at is null
        and reviewed_by is null
        and review_notes is null)
      or
      (status in ('VERIFIED', 'REJECTED')
        and reviewed_at is not null
        and reviewed_by is not null)
    )
);

create index if not exists kyc_requests_user_submitted_idx
  on public.kyc_requests (user_id, submitted_at desc);

create unique index if not exists kyc_requests_one_pending_per_user_idx
  on public.kyc_requests (user_id)
  where status = 'PENDING';

alter table public.kyc_requests enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'kyc_requests'
  loop
    execute format(
      'drop policy if exists %I on public.kyc_requests',
      policy_record.policyname
    );
  end loop;
end;
$$;

create policy "Users read their own KYC requests"
on public.kyc_requests
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Admins read all KYC requests"
on public.kyc_requests
for select
to authenticated
using (public.is_admin((select auth.uid())));

-- Direct writes are intentionally unavailable. Submission and review happen
-- through the validated RPCs below.
revoke all on table public.kyc_requests from public, anon, authenticated;
grant select on table public.kyc_requests to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'kyc-documents',
  'kyc-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (
        qual ilike '%kyc-documents%'
        or with_check ilike '%kyc-documents%'
        or policyname ilike '%KYC%'
      )
  loop
    execute format(
      'drop policy if exists %I on storage.objects',
      policy_record.policyname
    );
  end loop;
end;
$$;

create policy "KYC owners upload into their folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'kyc-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "KYC owners read their documents"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'kyc-documents'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.is_admin((select auth.uid()))
  )
);

create policy "KYC owners remove unsubmitted documents"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'kyc-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and not exists (
    select 1
    from public.kyc_requests request
    where request.object_path = name
  )
);

-- No UPDATE policy is provided: identity evidence is immutable once uploaded.

create or replace function public.submit_kyc_request(
  target_object_path text,
  target_original_file_name text,
  target_mime_type text,
  target_size_bytes bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  request_id uuid;
  uploaded_mime_type text;
  uploaded_size_bytes bigint;
begin
  if actor_id is null then
    raise insufficient_privilege using message = 'Authentication required.';
  end if;

  if target_object_path is null
     or target_object_path !~ ('^' || actor_id::text || '/[A-Za-z0-9._-]+$')
     or target_object_path ~ '(^|/)\.\.?(/|$)' then
    raise check_violation using message = 'Invalid KYC object path.';
  end if;

  if nullif(btrim(target_original_file_name), '') is null
     or length(target_original_file_name) > 255 then
    raise check_violation using message = 'Invalid original file name.';
  end if;

  if target_mime_type not in ('application/pdf', 'image/jpeg', 'image/png') then
    raise check_violation using message = 'Unsupported KYC document type.';
  end if;

  if target_size_bytes <= 0 or target_size_bytes > 10485760 then
    raise check_violation using message = 'KYC document exceeds the 10 MB limit.';
  end if;

  select
    object.metadata ->> 'mimetype',
    nullif(object.metadata ->> 'size', '')::bigint
  into
    uploaded_mime_type,
    uploaded_size_bytes
  from storage.objects object
  where object.bucket_id = 'kyc-documents'
    and object.name = target_object_path;

  if not found then
    raise check_violation using message = 'KYC document was not uploaded.';
  end if;

  if uploaded_mime_type is distinct from target_mime_type
     or uploaded_size_bytes is distinct from target_size_bytes then
    raise check_violation using message = 'KYC document metadata does not match the uploaded object.';
  end if;

  if exists (
    select 1
    from public.kyc_requests request
    where request.user_id = actor_id
      and request.status = 'PENDING'
  ) then
    raise unique_violation using message = 'A KYC request is already pending.';
  end if;

  insert into public.kyc_requests (
    user_id,
    object_path,
    original_file_name,
    mime_type,
    size_bytes
  )
  values (
    actor_id,
    target_object_path,
    btrim(target_original_file_name),
    target_mime_type,
    target_size_bytes
  )
  returning id into request_id;

  return request_id;
end;
$$;

revoke execute on function public.submit_kyc_request(text, text, text, bigint)
from public, anon;
grant execute on function public.submit_kyc_request(text, text, text, bigint)
to authenticated;

create or replace function public.review_kyc_request(
  target_request_id uuid,
  target_decision text,
  target_review_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  request_user_id uuid;
begin
  if actor_id is null or not public.is_admin(actor_id) then
    raise insufficient_privilege using message = 'Administrator access required.';
  end if;

  if target_decision not in ('VERIFIED', 'REJECTED') then
    raise check_violation using message = 'Decision must be VERIFIED or REJECTED.';
  end if;

  if target_decision = 'REJECTED'
     and nullif(btrim(target_review_notes), '') is null then
    raise check_violation using message = 'A rejection reason is required.';
  end if;

  select request.user_id
    into request_user_id
  from public.kyc_requests request
  where request.id = target_request_id
    and request.status = 'PENDING'
  for update;

  if request_user_id is null then
    raise no_data_found using message = 'Pending KYC request not found.';
  end if;

  update public.kyc_requests
  set
    status = target_decision,
    reviewed_at = now(),
    reviewed_by = actor_id,
    review_notes = nullif(btrim(target_review_notes), '')
  where id = target_request_id;

  update public.profiles
  set
    kyc_status = case
      when target_decision = 'VERIFIED' then 'VERIFIED'
      else 'FAILED'
    end,
    is_verified = (target_decision = 'VERIFIED')
  where id = request_user_id;
end;
$$;

revoke execute on function public.review_kyc_request(uuid, text, text)
from public, anon;
grant execute on function public.review_kyc_request(uuid, text, text)
to authenticated;
