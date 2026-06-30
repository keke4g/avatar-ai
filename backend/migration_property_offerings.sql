-- AuraSwap AI Hybrid Offerings
-- Adds an additive commercial layer for properties without changing existing swaps.

create extension if not exists "uuid-ossp";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'property_offering_mode') then
    create type public.property_offering_mode as enum (
      'SWAP',
      'SHORT_RENT',
      'MONTHLY_RENT',
      'SALE'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'property_offering_status') then
    create type public.property_offering_status as enum (
      'DRAFT',
      'ACTIVE',
      'PAUSED',
      'ARCHIVED',
      'SOLD',
      'RENTED'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'property_offering_visibility') then
    create type public.property_offering_visibility as enum (
      'PUBLIC',
      'PRIVATE',
      'UNLISTED'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'property_billing_period') then
    create type public.property_billing_period as enum (
      'NONE',
      'NIGHT',
      'WEEK',
      'MONTH',
      'TOTAL'
    );
  end if;
end
$$;

create table if not exists public.property_offerings (
  id uuid default uuid_generate_v4() primary key,
  property_id uuid not null references public.properties(id) on delete cascade,
  mode public.property_offering_mode not null,
  status public.property_offering_status not null default 'DRAFT',
  visibility public.property_offering_visibility not null default 'PUBLIC',
  title text,
  description text,
  price_amount numeric(14, 2),
  currency text not null default 'USD',
  billing_period public.property_billing_period not null default 'NONE',
  security_deposit_amount numeric(14, 2),
  cleaning_fee_amount numeric(14, 2),
  service_fee_percent numeric(5, 2),
  commission_percent numeric(5, 2),
  min_nights integer,
  max_nights integer,
  min_months integer,
  max_months integer,
  is_price_negotiable boolean not null default false,
  accepts_offers boolean not null default true,
  requires_approval boolean not null default true,
  allow_instant_request boolean not null default false,
  swap_preferences jsonb not null default '{}'::jsonb,
  swap_value_tier text,
  aura_score_override double precision,
  available_from date,
  available_until date,
  is_featured boolean not null default false,
  featured_until timestamp with time zone,
  featured_rank integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint property_offerings_unique_mode_per_property unique (property_id, mode),
  constraint property_offerings_currency_len check (char_length(currency) = 3),
  constraint property_offerings_price_rules check (
    (
      mode = 'SWAP'
      and billing_period = 'NONE'
    )
    or (
      mode = 'SHORT_RENT'
      and billing_period in ('NIGHT', 'WEEK')
      and price_amount is not null
    )
    or (
      mode = 'MONTHLY_RENT'
      and billing_period = 'MONTH'
      and price_amount is not null
    )
    or (
      mode = 'SALE'
      and billing_period = 'TOTAL'
      and price_amount is not null
    )
  ),
  constraint property_offerings_availability_dates check (
    available_from is null
    or available_until is null
    or available_from <= available_until
  ),
  constraint property_offerings_min_nights check (
    min_nights is null or max_nights is null or min_nights <= max_nights
  ),
  constraint property_offerings_min_months check (
    min_months is null or max_months is null or min_months <= max_months
  )
);

alter table public.properties
  add column if not exists featured_until timestamp with time zone,
  add column if not exists featured_rank integer not null default 0;

create table if not exists public.property_offering_availability (
  id uuid default uuid_generate_v4() primary key,
  offering_id uuid not null references public.property_offerings(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  is_available boolean not null default true,
  note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint property_offering_availability_dates check (start_date <= end_date)
);

create table if not exists public.property_offering_pricing_rules (
  id uuid default uuid_generate_v4() primary key,
  offering_id uuid not null references public.property_offerings(id) on delete cascade,
  start_date date,
  end_date date,
  price_amount numeric(14, 2) not null,
  currency text not null default 'USD',
  rule_type text not null default 'SEASONAL',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint property_offering_pricing_currency_len check (char_length(currency) = 3),
  constraint property_offering_pricing_dates check (
    start_date is null
    or end_date is null
    or start_date <= end_date
  )
);

create index if not exists idx_property_offerings_property
  on public.property_offerings(property_id);

create index if not exists idx_property_offerings_mode_status
  on public.property_offerings(mode, status);

create index if not exists idx_property_offerings_price
  on public.property_offerings(mode, price_amount);

create index if not exists idx_property_offerings_available
  on public.property_offerings(available_from, available_until);

create index if not exists idx_property_offerings_metadata
  on public.property_offerings using gin(metadata);

create index if not exists idx_property_offering_availability_offering
  on public.property_offering_availability(offering_id);

create index if not exists idx_property_offering_availability_dates
  on public.property_offering_availability(start_date, end_date);

create index if not exists idx_property_offering_pricing_offering
  on public.property_offering_pricing_rules(offering_id);

create or replace function public.set_property_offerings_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_property_offerings_updated_at on public.property_offerings;
create trigger set_property_offerings_updated_at
  before update on public.property_offerings
  for each row execute procedure public.set_property_offerings_updated_at();

alter table public.property_offerings enable row level security;
alter table public.property_offering_availability enable row level security;
alter table public.property_offering_pricing_rules enable row level security;

drop policy if exists "Public can view active public property offerings" on public.property_offerings;
create policy "Public can view active public property offerings"
  on public.property_offerings for select using (
    status = 'ACTIVE'
    and visibility = 'PUBLIC'
    and exists (
      select 1 from public.properties
      where properties.id = property_offerings.property_id
      and properties.is_published = true
    )
  );

drop policy if exists "Hosts can view their property offerings" on public.property_offerings;
create policy "Hosts can view their property offerings"
  on public.property_offerings for select using (
    auth.uid() = (
      select host_id from public.properties
      where properties.id = property_offerings.property_id
    )
  );

drop policy if exists "Hosts can create their property offerings" on public.property_offerings;
create policy "Hosts can create their property offerings"
  on public.property_offerings for insert with check (
    auth.uid() = (
      select host_id from public.properties
      where properties.id = property_offerings.property_id
    )
  );

drop policy if exists "Hosts can update their property offerings" on public.property_offerings;
create policy "Hosts can update their property offerings"
  on public.property_offerings for update using (
    auth.uid() = (
      select host_id from public.properties
      where properties.id = property_offerings.property_id
    )
  ) with check (
    auth.uid() = (
      select host_id from public.properties
      where properties.id = property_offerings.property_id
    )
  );

drop policy if exists "Hosts can delete their property offerings" on public.property_offerings;
create policy "Hosts can delete their property offerings"
  on public.property_offerings for delete using (
    auth.uid() = (
      select host_id from public.properties
      where properties.id = property_offerings.property_id
    )
  );

drop policy if exists "Admins can manage property offerings" on public.property_offerings;
create policy "Admins can manage property offerings"
  on public.property_offerings for all using (
    public.is_admin(auth.uid())
  ) with check (
    public.is_admin(auth.uid())
  );

drop policy if exists "Public can view active offering availability" on public.property_offering_availability;
create policy "Public can view active offering availability"
  on public.property_offering_availability for select using (
    exists (
      select 1 from public.property_offerings
      join public.properties on properties.id = property_offerings.property_id
      where property_offerings.id = property_offering_availability.offering_id
      and property_offerings.status = 'ACTIVE'
      and property_offerings.visibility = 'PUBLIC'
      and properties.is_published = true
    )
  );

drop policy if exists "Hosts can manage offering availability" on public.property_offering_availability;
create policy "Hosts can manage offering availability"
  on public.property_offering_availability for all using (
    exists (
      select 1 from public.property_offerings
      join public.properties on properties.id = property_offerings.property_id
      where property_offerings.id = property_offering_availability.offering_id
      and properties.host_id = auth.uid()
    )
    or public.is_admin(auth.uid())
  ) with check (
    exists (
      select 1 from public.property_offerings
      join public.properties on properties.id = property_offerings.property_id
      where property_offerings.id = property_offering_availability.offering_id
      and properties.host_id = auth.uid()
    )
    or public.is_admin(auth.uid())
  );

drop policy if exists "Public can view active offering pricing rules" on public.property_offering_pricing_rules;
create policy "Public can view active offering pricing rules"
  on public.property_offering_pricing_rules for select using (
    exists (
      select 1 from public.property_offerings
      join public.properties on properties.id = property_offerings.property_id
      where property_offerings.id = property_offering_pricing_rules.offering_id
      and property_offerings.status = 'ACTIVE'
      and property_offerings.visibility = 'PUBLIC'
      and properties.is_published = true
    )
  );

drop policy if exists "Hosts can manage offering pricing rules" on public.property_offering_pricing_rules;
create policy "Hosts can manage offering pricing rules"
  on public.property_offering_pricing_rules for all using (
    exists (
      select 1 from public.property_offerings
      join public.properties on properties.id = property_offerings.property_id
      where property_offerings.id = property_offering_pricing_rules.offering_id
      and properties.host_id = auth.uid()
    )
    or public.is_admin(auth.uid())
  ) with check (
    exists (
      select 1 from public.property_offerings
      join public.properties on properties.id = property_offerings.property_id
      where property_offerings.id = property_offering_pricing_rules.offering_id
      and properties.host_id = auth.uid()
    )
    or public.is_admin(auth.uid())
  );

insert into public.property_offerings (
  property_id,
  mode,
  status,
  visibility,
  title,
  description,
  currency,
  billing_period,
  swap_value_tier,
  aura_score_override,
  available_from,
  available_until,
  is_featured,
  featured_until,
  featured_rank,
  metadata
)
select
  p.id,
  'SWAP'::public.property_offering_mode,
  case
    when p.is_published is false then 'PAUSED'::public.property_offering_status
    else 'ACTIVE'::public.property_offering_status
  end,
  'PUBLIC'::public.property_offering_visibility,
  p.title,
  p.description,
  'USD',
  'NONE'::public.property_billing_period,
  p.value_rating,
  p.aura_score,
  p.created_at::date,
  null,
  coalesce(p.is_featured, false),
  p.featured_until,
  coalesce(p.featured_rank, 0),
  jsonb_build_object('source', 'migration_property_offerings', 'legacy_property_id', p.id)
from public.properties p
on conflict (property_id, mode) do nothing;
