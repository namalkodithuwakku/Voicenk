-- VoiceNK V1: live profile updates + same-language voice-only messages
-- Safe migration. Does not delete existing rows.

begin;

-- Same-language messages store only the original recording.
-- Different-language messages continue storing confirmed and translated text.
alter table public.messages
alter column original_transcript drop not null;

alter table public.messages
alter column translated_text drop not null;

-- Ensure profile updates can be received by Supabase Realtime.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end
$$;

-- Keep message updates available to realtime clients as well.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
