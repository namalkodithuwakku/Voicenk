-- VoiceNK V1 contacts, profile editing, privacy and same-language optimization
-- Safe/idempotent: does not delete existing profiles, conversations or messages.

begin;

create extension if not exists pgcrypto;

-- Profile preferences
alter table public.profiles add column if not exists preferred_voice text;
alter table public.profiles add column if not exists voice_category text;
alter table public.profiles add column if not exists profile_visibility text;

update public.profiles
set preferred_voice = coalesce(preferred_voice, 'marin'),
    voice_category = coalesce(voice_category, 'neutral'),
    profile_visibility = coalesce(profile_visibility, 'visible');

alter table public.profiles alter column preferred_voice set default 'marin';
alter table public.profiles alter column preferred_voice set not null;
alter table public.profiles alter column voice_category set default 'neutral';
alter table public.profiles alter column voice_category set not null;
alter table public.profiles alter column profile_visibility set default 'visible';
alter table public.profiles alter column profile_visibility set not null;

alter table public.profiles drop constraint if exists profiles_voice_category_check;
alter table public.profiles add constraint profiles_voice_category_check
check (voice_category in ('male','female','neutral'));

alter table public.profiles drop constraint if exists profiles_profile_visibility_check;
alter table public.profiles add constraint profiles_profile_visibility_check
check (profile_visibility in ('visible','invisible'));

alter table public.profiles drop constraint if exists profiles_display_name_length_check;
alter table public.profiles add constraint profiles_display_name_length_check
check (char_length(trim(display_name)) between 2 and 40);

alter table public.profiles drop constraint if exists profiles_voicenk_id_format_check;
alter table public.profiles add constraint profiles_voicenk_id_format_check
check (voicenk_id ~ '^[a-z0-9_-]{3,24}$');

-- Message metadata
alter table public.messages add column if not exists translation_status text;
alter table public.messages add column if not exists sender_voice text;

update public.messages
set translation_status = coalesce(
      translation_status,
      case
        when source_language = target_language then 'not_required'
        when translated_text is not null and translated_text <> '' then 'completed'
        else 'required'
      end
    ),
    sender_voice = coalesce(sender_voice, 'marin');

alter table public.messages alter column translation_status set default 'required';
alter table public.messages alter column translation_status set not null;
alter table public.messages alter column sender_voice set default 'marin';
alter table public.messages alter column sender_voice set not null;

alter table public.messages drop constraint if exists messages_translation_status_check;
alter table public.messages add constraint messages_translation_status_check
check (translation_status in ('required','completed','not_required','failed'));

-- Accepted contacts (two rows per relationship)
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  contact_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, contact_id),
  check (user_id <> contact_id)
);

create index if not exists contacts_user_created_idx
on public.contacts(user_id, created_at desc);

alter table public.contacts enable row level security;

drop policy if exists "Users view own contacts" on public.contacts;
create policy "Users view own contacts"
on public.contacts for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Users delete own contacts" on public.contacts;
create policy "Users delete own contacts"
on public.contacts for delete to authenticated
using (user_id = auth.uid());

-- Clean request policies and support incoming/outgoing pending requests.
drop policy if exists "Recipient can update" on public.contact_requests;
drop policy if exists "Recipients can update requests" on public.contact_requests;
drop policy if exists "Users can create requests" on public.contact_requests;
drop policy if exists "Users can send contact requests" on public.contact_requests;
drop policy if exists "Users can see own requests" on public.contact_requests;
drop policy if exists "Users can view own contact requests" on public.contact_requests;
drop policy if exists "Users view their requests" on public.contact_requests;
drop policy if exists "Users send requests" on public.contact_requests;
drop policy if exists "Senders refresh requests" on public.contact_requests;
drop policy if exists contact_requests_select on public.contact_requests;
drop policy if exists contact_requests_insert on public.contact_requests;
drop policy if exists contact_requests_update on public.contact_requests;
drop policy if exists contact_requests_delete on public.contact_requests;

create policy contact_requests_select
on public.contact_requests for select to authenticated
using (sender_id = auth.uid() or recipient_id = auth.uid());

create policy contact_requests_insert
on public.contact_requests for insert to authenticated
with check (sender_id = auth.uid() and recipient_id <> auth.uid());

create policy contact_requests_update
on public.contact_requests for update to authenticated
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

create policy contact_requests_delete
on public.contact_requests for delete to authenticated
using (sender_id = auth.uid() and status = 'pending');

-- Accept request: create/reuse conversation, create both contact rows, close request.
create or replace function public.accept_contact_request(request_id_input uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.contact_requests;
  conv_id uuid;
begin
  select * into req
  from public.contact_requests
  where id = request_id_input
    and recipient_id = auth.uid()
    and status = 'pending'
  for update;

  if req.id is null then
    raise exception 'Contact request not found';
  end if;

  select cm1.conversation_id into conv_id
  from public.conversation_members cm1
  join public.conversation_members cm2
    on cm2.conversation_id = cm1.conversation_id
  where cm1.user_id = req.sender_id
    and cm2.user_id = req.recipient_id
  limit 1;

  if conv_id is null then
    insert into public.conversations default values returning id into conv_id;
    insert into public.conversation_members(conversation_id, user_id)
    values (conv_id, req.sender_id), (conv_id, req.recipient_id)
    on conflict do nothing;
  end if;

  insert into public.contacts(user_id, contact_id, conversation_id)
  values
    (req.sender_id, req.recipient_id, conv_id),
    (req.recipient_id, req.sender_id, conv_id)
  on conflict (user_id, contact_id)
  do update set conversation_id = excluded.conversation_id;

  update public.contact_requests
  set status = 'accepted', updated_at = now()
  where id = req.id;

  return conv_id;
end;
$$;

revoke all on function public.accept_contact_request(uuid) from public;
grant execute on function public.accept_contact_request(uuid) to authenticated;

create index if not exists profiles_visibility_idx on public.profiles(profile_visibility);
create index if not exists profiles_voicenk_id_lower_idx on public.profiles(lower(voicenk_id));

-- Realtime updates for contacts if not already enabled.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='contacts'
  ) then
    alter publication supabase_realtime add table public.contacts;
  end if;
end $$;

notify pgrst, 'reload schema';
commit;
