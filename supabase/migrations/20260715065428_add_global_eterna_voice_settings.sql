create table public.platform_settings (
  key text primary key,
  voice_engine text not null,
  deepgram_voice_profile text not null default 'executive',
  updated_at timestamptz not null default now(),
  constraint platform_settings_known_key check (key = 'eterna_voice'),
  constraint platform_settings_voice_engine check (
    voice_engine in ('elevenlabs', 'deepgram', 'browser', 'azure')
  ),
  constraint platform_settings_deepgram_profile check (
    deepgram_voice_profile in ('executive', 'mexico')
  )
);

alter table public.platform_settings enable row level security;

revoke all on table public.platform_settings from anon, authenticated;
grant select on table public.platform_settings to anon, authenticated;
grant update on table public.platform_settings to authenticated;

create policy "Voice setting is publicly readable"
on public.platform_settings
for select
to anon, authenticated
using (key = 'eterna_voice');

create policy "Only admins can update the voice setting"
on public.platform_settings
for update
to authenticated
using (
  key = 'eterna_voice'
  and exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'ADMIN'
  )
)
with check (
  key = 'eterna_voice'
  and exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'ADMIN'
  )
);

insert into public.platform_settings (key, voice_engine, deepgram_voice_profile)
values ('eterna_voice', 'elevenlabs', 'executive')
on conflict (key) do nothing;
