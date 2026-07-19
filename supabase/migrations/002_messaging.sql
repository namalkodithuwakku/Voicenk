-- VoiceNK v1 one-to-one messaging
create extension if not exists pgcrypto;

create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(sender_id, recipient_id),
  check(sender_id <> recipient_id)
);
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key(conversation_id,user_id)
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  audio_path text not null,
  original_transcript text not null,
  translated_text text not null,
  source_language text not null,
  target_language text not null,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  played_at timestamptz
);
create index if not exists messages_conversation_created_idx on public.messages(conversation_id,created_at);

alter table public.contact_requests enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

create or replace function public.is_conversation_member(conversation_id_input uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.conversation_members
    where conversation_id=conversation_id_input and user_id=auth.uid()
  );
$$;
grant execute on function public.is_conversation_member(uuid) to authenticated;

drop policy if exists "Users view their requests" on public.contact_requests;
create policy "Users view their requests" on public.contact_requests for select to authenticated using (auth.uid()=sender_id or auth.uid()=recipient_id);
drop policy if exists "Users send requests" on public.contact_requests;
create policy "Users send requests" on public.contact_requests for insert to authenticated with check (auth.uid()=sender_id);
drop policy if exists "Recipients update requests" on public.contact_requests;
create policy "Recipients update requests" on public.contact_requests for update to authenticated using (auth.uid()=recipient_id) with check (auth.uid()=recipient_id);
drop policy if exists "Senders refresh requests" on public.contact_requests;
create policy "Senders refresh requests" on public.contact_requests for update to authenticated using (auth.uid()=sender_id) with check (auth.uid()=sender_id and status='pending');
drop policy if exists "Members view conversations" on public.conversations;
create policy "Members view conversations" on public.conversations for select to authenticated using (public.is_conversation_member(id));
drop policy if exists "Members view membership" on public.conversation_members;
create policy "Members view membership" on public.conversation_members for select to authenticated using (public.is_conversation_member(conversation_id));
drop policy if exists "Members read messages" on public.messages;
create policy "Members read messages" on public.messages for select to authenticated using (public.is_conversation_member(conversation_id));
drop policy if exists "Members send messages" on public.messages;
create policy "Members send messages" on public.messages for insert to authenticated with check (auth.uid()=sender_id and public.is_conversation_member(conversation_id));
drop policy if exists "Recipients update message status" on public.messages;
create policy "Recipients update message status" on public.messages for update to authenticated using (sender_id<>auth.uid() and public.is_conversation_member(conversation_id));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('voice-messages','voice-messages',false,12582912,array['audio/webm','audio/mp4','audio/mpeg','audio/ogg'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "Members upload voice" on storage.objects;
create policy "Members upload voice" on storage.objects for insert to authenticated with check (bucket_id='voice-messages' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "Members read conversation voice" on storage.objects;
create policy "Members read conversation voice" on storage.objects for select to authenticated using (bucket_id='voice-messages' and public.is_conversation_member(((storage.foldername(name))[2])::uuid));

create or replace function public.accept_contact_request(request_id_input uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare req public.contact_requests; conv_id uuid;
begin
 select * into req from public.contact_requests where id=request_id_input and recipient_id=auth.uid() and status='pending' for update;
 if req.id is null then raise exception 'Contact request not found'; end if;
 select cm1.conversation_id into conv_id from public.conversation_members cm1 join public.conversation_members cm2 on cm2.conversation_id=cm1.conversation_id where cm1.user_id=req.sender_id and cm2.user_id=req.recipient_id limit 1;
 if conv_id is null then insert into public.conversations default values returning id into conv_id; insert into public.conversation_members(conversation_id,user_id) values(conv_id,req.sender_id),(conv_id,req.recipient_id); end if;
 update public.contact_requests set status='accepted',updated_at=now() where id=req.id;
 return conv_id;
end $$;
grant execute on function public.accept_contact_request(uuid) to authenticated;

create or replace function public.get_my_conversations()
returns table(conversation_id uuid, contact jsonb, last_message text, last_message_at timestamptz, unread_count bigint)
language sql security definer set search_path=public as $$
 select c.id, jsonb_build_object('id',p.id,'display_name',p.display_name,'voicenk_id',p.voicenk_id,'preferred_language',p.preferred_language,'avatar_url',p.avatar_url),
 coalesce((select case when m.sender_id=auth.uid() then m.original_transcript else m.translated_text end from public.messages m where m.conversation_id=c.id order by m.created_at desc limit 1),'Start a voice conversation'),
 (select m.created_at from public.messages m where m.conversation_id=c.id order by m.created_at desc limit 1),
 (select count(*) from public.messages m where m.conversation_id=c.id and m.sender_id<>auth.uid() and (mine.last_read_at is null or m.created_at>mine.last_read_at))
 from public.conversations c join public.conversation_members mine on mine.conversation_id=c.id and mine.user_id=auth.uid() join public.conversation_members other on other.conversation_id=c.id and other.user_id<>auth.uid() join public.profiles p on p.id=other.user_id order by 4 desc nulls last;
$$;
grant execute on function public.get_my_conversations() to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='contact_requests') then
    alter publication supabase_realtime add table public.contact_requests;
  end if;
end $$;
