-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. PROFILES TABLE (Linked directly to Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  name text not null,
  avatar_url text,
  role text not null default 'MEMBER' check (role in ('MEMBER', 'HOST', 'ADMIN')),
  kyc_status text not null default 'PENDING' check (kyc_status in ('PENDING', 'VERIFIED', 'FAILED')),
  is_verified boolean not null default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row-Level Security for profiles
alter table public.profiles enable row level security;

-- 2. PROPERTIES TABLE (Images normalized out to property_images)
create table public.properties (
  id uuid default uuid_generate_v4() primary key,
  host_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text not null,
  type text not null check (type in ('Apartment', 'Beach House', 'Cabin', 'Penthouse', 'Villa', 'Loft')),
  value_rating text not null check (value_rating in ('Premium', 'Luxury', 'Exclusive', 'Curated')),
  location text not null,
  country text not null,
  address text,
  latitude double precision not null,
  longitude double precision not null,
  bedrooms integer not null default 1,
  bathrooms integer not null default 1,
  max_guests integer not null default 2,
  aura_score double precision not null default 90.0,
  amenities text[] not null default '{}',
  rules text[] not null default '{}',
  is_published boolean not null default true,
  is_featured boolean not null default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.properties enable row level security;

-- 3. PROPERTY_IMAGES TABLE (Normalized images entity)
create table public.property_images (
  id uuid default uuid_generate_v4() primary key,
  property_id uuid references public.properties(id) on delete cascade not null,
  image_url text not null,
  display_order integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.property_images enable row level security;

-- 4. FAVORITES TABLE (Normalized favorites junction entity)
create table public.favorites (
  user_id uuid references public.profiles(id) on delete cascade not null,
  property_id uuid references public.properties(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id, property_id)
);

alter table public.favorites enable row level security;

-- 5. SWAPS TABLE
create table public.swaps (
  id uuid default uuid_generate_v4() primary key,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  receiver_id uuid references public.profiles(id) on delete cascade not null,
  sender_property_id uuid references public.properties(id) on delete cascade not null,
  receiver_property_id uuid references public.properties(id) on delete cascade not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'DECLINED')),
  is_disputed boolean not null default false,
  message text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint check_dates check (start_date < end_date)
);

alter table public.swaps enable row level security;

-- 6. MESSAGES TABLE
create table public.messages (
  id uuid default uuid_generate_v4() primary key,
  swap_id uuid references public.swaps(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.messages enable row level security;

-- 7. REVIEWS TABLE
create table public.reviews (
  id uuid default uuid_generate_v4() primary key,
  swap_id uuid references public.swaps(id) on delete cascade not null,
  author_id uuid references public.profiles(id) on delete cascade not null,
  target_property_id uuid references public.properties(id) on delete cascade not null,
  rating numeric(3, 2) not null check (rating >= 1.0 and rating <= 5.0),
  comment text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.reviews enable row level security;

-- 8. DISPUTES TABLE
create table public.disputes (
  id uuid default uuid_generate_v4() primary key,
  swap_id uuid references public.swaps(id) on delete cascade not null,
  reason text not null,
  status text not null default 'OPEN' check (status in ('OPEN', 'RESOLVED', 'DISMISSED')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.disputes enable row level security;

-- 9. NOTIFICATIONS TABLE
create table public.notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  content text not null,
  is_read boolean not null default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.notifications enable row level security;

-- INDEXES FOR HIGH-PERFORMANCE QUERYING & SEARCH
create index idx_properties_location on public.properties(location, country);
create index idx_properties_host on public.properties(host_id);
create index idx_property_images_property on public.property_images(property_id);
create index idx_favorites_user on public.favorites(user_id);
create index idx_swaps_users on public.swaps(sender_id, receiver_id);
create index idx_messages_swap on public.messages(swap_id);
create index idx_reviews_property on public.reviews(target_property_id);
create index idx_notifications_user_unread on public.notifications(user_id) where is_read = false;

-- AUTOMATIC DATABASE PROFILE CREATION TRIGGER
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', 'AuraSwap Member'),
    coalesce(new.raw_user_meta_data->>'avatar_url', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'),
    'MEMBER'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- SECURITY DEFINER HELPER FUNCTION TO BYPASS RLS RECURSION
create or replace function public.is_admin(user_id uuid)
returns boolean as $$
declare
  user_role text;
begin
  select role into user_role from public.profiles where id = user_id;
  return user_role = 'ADMIN';
end;
$$ language plpgsql security definer set search_path = public;

-- ROW-LEVEL SECURITY ACCESS POLICIES

-- profiles: Public read, only owner can update their own profile data, admins can update/delete
create policy "Profiles are public readable" on public.profiles for select using (true);
create policy "Owners can update their profiles" on public.profiles for update using (auth.uid() = id);
create policy "Admins can update profiles" on public.profiles for update using (
  public.is_admin(auth.uid())
);
create policy "Admins can delete profiles" on public.profiles for delete using (
  public.is_admin(auth.uid())
);

-- properties: Public read, authenticated hosts can create, host can update/delete their own, ADMIN can do all
create policy "Properties are public readable" on public.properties for select using (true);
create policy "Authenticated users can create properties" on public.properties for insert with check (
  auth.role() = 'authenticated'
);
create policy "Hosts can update their properties" on public.properties for update using (
  auth.uid() = host_id
);
create policy "Hosts can delete their properties" on public.properties for delete using (
  auth.uid() = host_id
);
create policy "Admins have total control on properties" on public.properties for all using (
  public.is_admin(auth.uid())
);

-- property_images: Public read, authenticated properties host can create/update/delete, ADMIN can do all
create policy "Property images are public readable" on public.property_images for select using (true);
create policy "Hosts can modify their property images" on public.property_images for all using (
  auth.role() = 'authenticated' and (
    exists (
      select 1 from public.properties 
      where id = property_id and host_id = auth.uid()
    )
  )
);
create policy "Admins have total control on property images" on public.property_images for all using (
  public.is_admin(auth.uid())
);

-- favorites: Owner can select/insert/delete their own favorites, ADMIN can do all
create policy "Users can manage their favorites" on public.favorites for all using (
  auth.uid() = user_id
);
create policy "Admins have total control on favorites" on public.favorites for all using (
  public.is_admin(auth.uid())
);

-- swaps: Involved users (sender/receiver) can select, sender can create, receiver can update status, ADMIN can do all
create policy "Users can view their swaps" on public.swaps for select using (
  auth.uid() = sender_id or auth.uid() = receiver_id
);
create policy "Senders can create swaps" on public.swaps for insert with check (
  auth.uid() = sender_id
);
create policy "Involved parties can update swaps" on public.swaps for update using (
  auth.uid() = sender_id or auth.uid() = receiver_id
);
create policy "Admins have total control on swaps" on public.swaps for all using (
  public.is_admin(auth.uid())
);

-- messages: Users involved in the matching swap can read/write, ADMIN can do all
create policy "Users can view swap messages" on public.messages for select using (
  exists (
    select 1 from public.swaps 
    where id = swap_id and (sender_id = auth.uid() or receiver_id = auth.uid())
  )
);
create policy "Users can send swap messages" on public.messages for insert with check (
  auth.uid() = sender_id and exists (
    select 1 from public.swaps 
    where id = swap_id and (sender_id = auth.uid() or receiver_id = auth.uid())
  )
);
create policy "Admins have total control on messages" on public.messages for all using (
  public.is_admin(auth.uid())
);

-- reviews: Public read, swap participants can insert, ADMIN can do all
create policy "Reviews are public readable" on public.reviews for select using (true);
create policy "Swap participants can review" on public.reviews for insert with check (
  auth.uid() = author_id and exists (
    select 1 from public.swaps 
    where id = swap_id and (sender_id = auth.uid() or receiver_id = auth.uid())
  )
);
create policy "Admins have total control on reviews" on public.reviews for all using (
  public.is_admin(auth.uid())
);

-- disputes: Swap participants can select/insert, ADMIN can do all
create policy "Swap participants can view disputes" on public.disputes for select using (
  exists (
    select 1 from public.swaps 
    where id = swap_id and (sender_id = auth.uid() or receiver_id = auth.uid())
  )
);
create policy "Swap participants can file disputes" on public.disputes for insert with check (
  exists (
    select 1 from public.swaps 
    where id = swap_id and (sender_id = auth.uid() or receiver_id = auth.uid())
  )
);
create policy "Admins have total control on disputes" on public.disputes for all using (
  public.is_admin(auth.uid())
);

-- notifications: User can view and update their own notifications, ADMIN can do all
create policy "Users can manage their notifications" on public.notifications for all using (
  auth.uid() = user_id
);
create policy "Admins have total control on notifications" on public.notifications for all using (
  public.is_admin(auth.uid())
);
