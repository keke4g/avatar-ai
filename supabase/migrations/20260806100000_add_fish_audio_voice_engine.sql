alter table public.platform_settings
  drop constraint if exists platform_settings_voice_engine;

alter table public.platform_settings
  add constraint platform_settings_voice_engine check (
    voice_engine in ('elevenlabs', 'deepgram', 'fishaudio', 'browser', 'azure')
  );
