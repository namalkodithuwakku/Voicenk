"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import { MessagesIcon } from "@/components/ui/Icons";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";
import { ConversationView } from "@/features/messages/components/ConversationView";
import type {
  ContactProfile,
  ContactRecord,
  ContactRequest,
  ConversationSummary,
} from "@/types/messaging";

const profileFields =
  "id,display_name,voicenk_id,preferred_language,preferred_voice,voice_category,profile_visibility,avatar_url";

export function MessagesScreen({ onSignIn }: { onSignIn: () => void }) {
  const { user, profile, loading } = useAuth();
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [incoming, setIncoming] = useState<ContactRequest[]>([]);
  const [outgoing, setOutgoing] = useState<ContactRequest[]>([]);
  const [selected, setSelected] = useState<ConversationSummary | null>(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ContactProfile[]>([]);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!user) return;

    const supabase = createClient();
    const [contactsResult, incomingResult, outgoingResult] = await Promise.all([
      supabase
        .from("contacts")
        .select(
          `id,user_id,contact_id,conversation_id,created_at,profile:profiles!contacts_contact_id_fkey(${profileFields})`,
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contact_requests")
        .select(
          `id,sender_id,recipient_id,status,created_at,sender:profiles!contact_requests_sender_id_fkey(${profileFields})`,
        )
        .eq("recipient_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("contact_requests")
        .select(
          `id,sender_id,recipient_id,status,created_at,recipient:profiles!contact_requests_recipient_id_fkey(${profileFields})`,
        )
        .eq("sender_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);

    const firstError =
      contactsResult.error ?? incomingResult.error ?? outgoingResult.error;
    if (firstError) {
      setError(firstError.message);
      return;
    }

    const contactRows = (contactsResult.data ?? []).map((row) => ({
      ...row,
      profile: row.profile as unknown as ContactProfile,
    })) as ContactRecord[];

    const incomingRows = (incomingResult.data ?? []).map((row) => ({
      ...row,
      sender: row.sender as unknown as ContactProfile,
    })) as ContactRequest[];

    const outgoingRows = (outgoingResult.data ?? []).map((row) => ({
      ...row,
      recipient: row.recipient as unknown as ContactProfile,
    })) as ContactRequest[];

    setContacts(contactRows);
    setIncoming(incomingRows);
    setOutgoing(outgoingRows);

    const conversationIds = contactRows.map((item) => item.conversation_id);
    if (conversationIds.length === 0) {
      setConversations([]);
      setError("");
      return;
    }

    const { data: messageRows, error: messageError } = await supabase
      .from("messages")
      .select(
        "id,conversation_id,sender_id,original_transcript,translated_text,created_at",
      )
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false });

    if (messageError) {
      setError(messageError.message);
      return;
    }

    const allMessages = messageRows ?? [];
    const nextConversations = contactRows
      .map<ConversationSummary>((contact) => {
        const conversationMessages = allMessages.filter(
          (message) => message.conversation_id === contact.conversation_id,
        );
        const latest = conversationMessages[0] ?? null;

        return {
          id: contact.conversation_id,
          contact: contact.profile,
          lastMessage: latest
            ? (latest.sender_id === user.id
                ? latest.original_transcript
                : latest.translated_text) ?? "Voice message"
            : "Start a voice conversation",
          lastMessageAt: latest?.created_at ?? null,
          unreadCount: 0,
        };
      })
      .filter((conversation) => Boolean(conversation.lastMessageAt))
      .sort((first, second) => {
        const firstTime = first.lastMessageAt
          ? new Date(first.lastMessageAt).getTime()
          : 0;
        const secondTime = second.lastMessageAt
          ? new Date(second.lastMessageAt).getTime()
          : 0;
        return secondTime - firstTime;
      });

    setConversations(nextConversations);
    setSelected((current) => {
      if (!current) return null;

      const refreshed = contactRows.find(
        (item) => item.conversation_id === current.id,
      );

      return refreshed
        ? {
            ...current,
            contact: refreshed.profile,
          }
        : current;
    });
    setError("");
  }, [user]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`messages-home-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => void load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contact_requests" },
        () => void load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contacts" },
        () => void load(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        () => void load(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load, user]);

  useEffect(() => {
    if (!user || search.trim().length < 2) return;

    const timer = window.setTimeout(async () => {
      const query = search.trim().replace(/^@/, "");
      const { data, error: searchError } = await createClient()
        .from("profiles")
        .select(profileFields)
        .eq("profile_visibility", "visible")
        .neq("id", user.id)
        .or(`voicenk_id.ilike.%${query}%,display_name.ilike.%${query}%`)
        .limit(12);

      if (searchError) {
        setError(searchError.message);
        return;
      }

      setResults((data ?? []) as ContactProfile[]);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [search, user]);

  async function sendRequest(recipientId: string) {
    if (!user) return;
    setBusyId(recipientId);
    setError("");
    setNotice("");

    const { error: requestError } = await createClient()
      .from("contact_requests")
      .insert({
        sender_id: user.id,
        recipient_id: recipientId,
        status: "pending",
      });

    if (requestError) {
      setError(
        requestError.code === "23505"
          ? "A contact request already exists."
          : requestError.message,
      );
    } else {
      setNotice("Contact request sent.");
      setSearch("");
      setResults([]);
      await load();
    }

    setBusyId("");
  }

  async function acceptRequest(requestId: string) {
    setBusyId(requestId);
    setError("");
    setNotice("");

    const { error: acceptError } = await createClient().rpc(
      "accept_contact_request",
      { request_id_input: requestId },
    );

    if (acceptError) {
      setError(acceptError.message);
    } else {
      setNotice("Contact accepted. You can now start chatting.");
      await load();
    }

    setBusyId("");
  }

  async function declineRequest(requestId: string) {
    setBusyId(requestId);
    const { error: declineError } = await createClient()
      .from("contact_requests")
      .update({ status: "declined" })
      .eq("id", requestId);

    if (declineError) setError(declineError.message);
    else await load();
    setBusyId("");
  }

  async function cancelRequest(requestId: string) {
    setBusyId(requestId);
    const { error: cancelError } = await createClient()
      .from("contact_requests")
      .delete()
      .eq("id", requestId);

    if (cancelError) setError(cancelError.message);
    else {
      setNotice("Request cancelled.");
      await load();
    }
    setBusyId("");
  }

  function openContact(contact: ContactRecord) {
    setSelected({
      id: contact.conversation_id,
      contact: contact.profile,
      lastMessage: "Start a voice conversation",
      lastMessageAt: null,
      unreadCount: 0,
    });
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm font-bold text-muted">
        Checking your session…
      </div>
    );
  }

  if (!user) return <GuestState onSignIn={onSignIn} />;

  if (selected) {
    return (
      <ConversationView
        conversation={selected}
        currentUserId={user.id}
        sourceLanguage={profile?.preferred_language ?? "en"}
        senderVoice={profile?.preferred_voice ?? "marin"}
        onBack={() => {
          setSelected(null);
          void load();
        }}
      />
    );
  }

  const hasSearch = search.trim().length >= 2;
  const contactIds = new Set(contacts.map((item) => item.contact_id));
  const pendingIds = new Set([
    ...incoming.map((item) => item.sender_id),
    ...outgoing.map((item) => item.recipient_id),
  ]);
  const visibleResults = results.filter(
    (item) => !contactIds.has(item.id) && !pendingIds.has(item.id),
  );

  return (
    <section className="flex h-full min-h-0 flex-col py-3">
      <div className="shrink-0">
        <h1 className="text-2xl font-black tracking-[-0.04em]">Messages</h1>
        <p className="text-xs font-semibold text-muted">
          Every person hears their own language.
        </p>
      </div>

      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search name or @VoiceNKID"
        className="mt-3 min-h-12 shrink-0 rounded-2xl bg-surface-soft px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-accent/30"
      />

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto pb-3">
        {hasSearch && (
          <Section title="Search results">
            {visibleResults.map((item) => (
              <PersonRow
                key={item.id}
                profile={item}
                action="Add"
                disabled={Boolean(busyId)}
                onAction={() => void sendRequest(item.id)}
              />
            ))}
            {visibleResults.length === 0 && (
              <EmptyText text="No new users found." />
            )}
          </Section>
        )}

        {!hasSearch && incoming.length > 0 && (
          <Section title="Incoming requests">
            {incoming.map((request) =>
              request.sender ? (
                <RequestCard
                  key={request.id}
                  profile={request.sender}
                  primary="Accept"
                  secondary="Decline"
                  disabled={Boolean(busyId)}
                  onPrimary={() => void acceptRequest(request.id)}
                  onSecondary={() => void declineRequest(request.id)}
                />
              ) : null,
            )}
          </Section>
        )}

        {!hasSearch && outgoing.length > 0 && (
          <Section title="Sent requests">
            {outgoing.map((request) =>
              request.recipient ? (
                <RequestCard
                  key={request.id}
                  profile={request.recipient}
                  primary="Pending"
                  secondary="Cancel"
                  disabled={Boolean(busyId)}
                  primaryDisabled
                  onPrimary={() => undefined}
                  onSecondary={() => void cancelRequest(request.id)}
                />
              ) : null,
            )}
          </Section>
        )}

        {!hasSearch && contacts.length > 0 && (
          <Section title="Contacts">
            {contacts.map((contact) => (
              <PersonRow
                key={contact.id}
                profile={contact.profile}
                action="Chat"
                disabled={false}
                onAction={() => openContact(contact)}
              />
            ))}
          </Section>
        )}

        {!hasSearch && conversations.length > 0 && (
          <Section title="Recent chats">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => setSelected(conversation)}
                className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-surface-soft"
              >
                <Avatar profile={conversation.contact} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-black">
                      {conversation.contact.display_name}
                    </p>
                    <span className="text-[10px] font-bold text-muted">
                      {formatDate(conversation.lastMessageAt)}
                    </span>
                  </div>
                  <p className="truncate text-xs font-semibold text-muted">
                    {conversation.lastMessage}
                  </p>
                </div>
              </button>
            ))}
          </Section>
        )}

        {!hasSearch &&
          contacts.length === 0 &&
          incoming.length === 0 &&
          outgoing.length === 0 && (
            <div className="mt-12 text-center">
              <MessagesIcon className="mx-auto h-8 w-8 text-muted" />
              <p className="mt-3 font-black">No contacts yet</p>
              <p className="mt-1 text-xs font-semibold text-muted">
                Search a VoiceNK ID and send your first request.
              </p>
            </div>
          )}

        {notice && (
          <p className="mt-3 rounded-xl bg-green-50 p-3 text-xs font-bold text-green-700">
            {notice}
          </p>
        )}
        {error && (
          <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-5">
      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-accent-strong">
        {title}
      </p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function GuestState({ onSignIn }: { onSignIn: () => void }) {
  return (
    <section className="flex h-full items-center">
      <div className="rounded-[2rem] border border-border p-6 shadow-[var(--shadow-soft)]">
        <MessagesIcon className="h-8 w-8 text-accent-strong" />
        <h1 className="mt-5 text-3xl font-black tracking-[-0.04em]">
          Sign in to send voice messages.
        </h1>
        <p className="mt-3 text-sm font-medium leading-6 text-muted">
          Interpreter stays free without an account.
        </p>
        <button
          type="button"
          onClick={onSignIn}
          className="mt-5 min-h-14 w-full rounded-2xl bg-foreground font-black text-white"
        >
          Continue to sign in
        </button>
      </div>
    </section>
  );
}

function RequestCard({
  profile,
  primary,
  secondary,
  disabled,
  primaryDisabled = false,
  onPrimary,
  onSecondary,
}: {
  profile: ContactProfile;
  primary: string;
  secondary: string;
  disabled: boolean;
  primaryDisabled?: boolean;
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  return (
    <div className="rounded-2xl bg-accent-soft p-3">
      <div className="flex items-center gap-3">
        <Avatar profile={profile} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black">{profile.display_name}</p>
          <p className="truncate text-xs font-bold text-accent-strong">
            @{profile.voicenk_id}
          </p>
        </div>
        <button
          type="button"
          disabled={disabled || primaryDisabled}
          onClick={onPrimary}
          className="rounded-xl bg-foreground px-3 py-2 text-xs font-black text-white disabled:opacity-55"
        >
          {primary}
        </button>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onSecondary}
        className="mt-2 min-h-9 w-full text-xs font-black text-muted disabled:opacity-50"
      >
        {secondary}
      </button>
    </div>
  );
}

function PersonRow({
  profile,
  action,
  disabled,
  onAction,
}: {
  profile: ContactProfile;
  action: string;
  disabled: boolean;
  onAction: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface-soft p-3">
      <Avatar profile={profile} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black">{profile.display_name}</p>
        <p className="truncate text-xs font-bold text-accent-strong">
          @{profile.voicenk_id}
        </p>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onAction}
        className="rounded-xl bg-foreground px-3 py-2 text-xs font-black text-white disabled:opacity-50"
      >
        {action}
      </button>
    </div>
  );
}

function Avatar({ profile }: { profile: ContactProfile }) {
  return (
    <div className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-foreground font-black text-accent">
      {profile.avatar_url ? (
        <Image
          src={profile.avatar_url}
          alt=""
          fill
          sizes="44px"
          className="object-cover"
          unoptimized
        />
      ) : (
        profile.display_name.slice(0, 1).toUpperCase()
      )}
    </div>
  );
}

function EmptyText({ text }: { text: string }) {
  return <p className="py-5 text-center text-xs font-bold text-muted">{text}</p>;
}

function formatDate(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
