"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { MessagesIcon } from "@/components/ui/Icons";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";
import { ConversationView } from "@/features/messages/components/ConversationView";
import type {
  ContactProfile,
  ContactRequest,
  ConversationSummary,
} from "@/types/messaging";

export function MessagesScreen({
  onSignIn,
}: {
  onSignIn: () => void;
}) {
  const { user, profile, loading } = useAuth();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [requests, setRequests] = useState<ContactRequest[]>([]);
  const [selected, setSelected] = useState<ConversationSummary | null>(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ContactProfile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user) return;

    const supabase = createClient();

    const [
      { data: myMemberships, error: membershipError },
      { data: reqData, error: requestLoadError },
    ] = await Promise.all([
      supabase
        .from("conversation_members")
        .select("conversation_id,last_read_at")
        .eq("user_id", user.id),
      supabase
        .from("contact_requests")
        .select(
          "id,sender_id,recipient_id,status,created_at,sender:profiles!contact_requests_sender_id_fkey(id,display_name,voicenk_id,preferred_language,avatar_url)",
        )
        .eq("recipient_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);

    if (membershipError) {
      setError(membershipError.message);
      setConversations([]);
      return;
    }

    if (requestLoadError) {
      setError(requestLoadError.message);
    }

    const memberships = myMemberships ?? [];
    const conversationIds = memberships.map(
      (membership) => membership.conversation_id,
    );

    if (conversationIds.length === 0) {
      setConversations([]);
      setRequests((reqData ?? []) as unknown as ContactRequest[]);
      return;
    }

    const [
      { data: otherMembers, error: otherMembersError },
      { data: messageRows, error: messagesError },
    ] = await Promise.all([
      supabase
        .from("conversation_members")
        .select(
          "conversation_id,user_id,profile:profiles!conversation_members_user_id_fkey(id,display_name,voicenk_id,preferred_language,avatar_url)",
        )
        .in("conversation_id", conversationIds)
        .neq("user_id", user.id),
      supabase
        .from("messages")
        .select(
          "id,conversation_id,sender_id,original_transcript,translated_text,created_at",
        )
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false }),
    ]);

    if (otherMembersError) {
      setError(otherMembersError.message);
      setConversations([]);
      return;
    }

    if (messagesError) {
      setError(messagesError.message);
    }

    const allMessages = messageRows ?? [];

    const nextConversations: ConversationSummary[] = (
      otherMembers ?? []
    ).map((member) => {
      const contact = member.profile as unknown as ContactProfile;
      const membership = memberships.find(
        (item) => item.conversation_id === member.conversation_id,
      );

      const conversationMessages = allMessages.filter(
        (message) =>
          message.conversation_id === member.conversation_id,
      );

      const latestMessage = conversationMessages[0] ?? null;
      const lastReadAt = membership?.last_read_at
        ? new Date(membership.last_read_at).getTime()
        : 0;

      const unreadCount = conversationMessages.filter((message) => {
        if (message.sender_id === user.id) return false;

        return (
          new Date(message.created_at).getTime() > lastReadAt
        );
      }).length;

      return {
        id: member.conversation_id,
        contact,
        lastMessage: latestMessage
          ? latestMessage.sender_id === user.id
            ? latestMessage.original_transcript
            : latestMessage.translated_text
          : "Start a voice conversation",
        lastMessageAt: latestMessage?.created_at ?? null,
        unreadCount,
      };
    });

    nextConversations.sort((first, second) => {
      const firstTime = first.lastMessageAt
        ? new Date(first.lastMessageAt).getTime()
        : 0;
      const secondTime = second.lastMessageAt
        ? new Date(second.lastMessageAt).getTime()
        : 0;

      return secondTime - firstTime;
    });

    setConversations(nextConversations);
    setRequests((reqData ?? []) as unknown as ContactRequest[]);
  }, [user]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!user) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`messages-home-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        () => void load(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "contact_requests",
        },
        () => void load(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load, user]);

  useEffect(() => {
    if (!user || search.trim().length < 2) {
      return;
    }

    const timer = window.setTimeout(async () => {
      const query = search.trim().replace(/^@/, "");

      const { data } = await createClient()
        .from("profiles")
        .select(
          "id,display_name,voicenk_id,preferred_language,avatar_url",
        )
        .neq("id", user.id)
        .or(
          `voicenk_id.ilike.%${query}%,display_name.ilike.%${query}%`,
        )
        .limit(12);

      setResults((data ?? []) as ContactProfile[]);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [search, user]);

  const visibleResults =
    search.trim().length >= 2 ? results : [];

  async function sendRequest(recipientId: string) {
    if (!user) return;

    setBusy(true);
    setError("");

    const { error: requestError } = await createClient()
      .from("contact_requests")
      .upsert(
        {
          sender_id: user.id,
          recipient_id: recipientId,
          status: "pending",
        },
        {
          onConflict: "sender_id,recipient_id",
        },
      );

    if (requestError) {
      setError(requestError.message);
    } else {
      setSearch("");
      setResults([]);
    }

    setBusy(false);
  }

  async function respond(requestId: string, accept: boolean) {
    setBusy(true);
    setError("");

    const supabase = createClient();

    if (accept) {
      const { error: rpcError } = await supabase.rpc(
        "accept_contact_request",
        {
          request_id_input: requestId,
        },
      );

      if (rpcError) {
        setError(rpcError.message);
      }
    } else {
      const { error: declineError } = await supabase
        .from("contact_requests")
        .update({ status: "declined" })
        .eq("id", requestId);

      if (declineError) {
        setError(declineError.message);
      }
    }

    await load();
    setBusy(false);
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm font-bold text-muted">
        Checking your session…
      </div>
    );
  }

  if (!user) {
    return <GuestState onSignIn={onSignIn} />;
  }

  if (selected) {
    return (
      <ConversationView
        conversation={selected}
        currentUserId={user.id}
        sourceLanguage={profile?.preferred_language ?? "en"}
        onBack={() => {
          setSelected(null);
          void load();
        }}
      />
    );
  }

  const hasSearch = search.trim().length >= 2;

  return (
    <section className="flex h-full min-h-0 flex-col py-3">
      <div className="shrink-0">
        <h1 className="text-2xl font-black tracking-[-0.04em]">
          Messages
        </h1>
        <p className="text-xs font-semibold text-muted">
          Every person hears their own language.
        </p>
      </div>

      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search name or @VoicenkID"
        className="mt-3 min-h-12 shrink-0 rounded-2xl bg-surface-soft px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-accent/30"
      />

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
        {hasSearch && (
          <div className="space-y-2">
            {visibleResults.map((item) => (
              <UserRow
                key={item.id}
                profile={item}
                action="Add"
                disabled={busy}
                onAction={() => void sendRequest(item.id)}
              />
            ))}

            {visibleResults.length === 0 && (
              <p className="py-6 text-center text-sm font-bold text-muted">
                No users found.
              </p>
            )}
          </div>
        )}

        {!hasSearch && requests.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-accent-strong">
              Contact requests
            </p>

            <div className="space-y-2">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="rounded-2xl bg-accent-soft p-3"
                >
                  <UserRow
                    profile={request.sender}
                    action="Accept"
                    disabled={busy}
                    onAction={() =>
                      void respond(request.id, true)
                    }
                  />

                  <button
                    type="button"
                    onClick={() =>
                      void respond(request.id, false)
                    }
                    className="mt-2 w-full text-xs font-black text-muted"
                  >
                    Decline
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {!hasSearch && (
          <div className="space-y-1">
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

                {conversation.unreadCount > 0 && (
                  <span className="grid h-6 min-w-6 place-items-center rounded-full bg-accent px-1 text-[10px] font-black">
                    {conversation.unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {!hasSearch &&
          conversations.length === 0 &&
          requests.length === 0 && (
            <div className="mt-12 text-center">
              <MessagesIcon className="mx-auto h-8 w-8 text-muted" />
              <p className="mt-3 font-black">
                No conversations yet
              </p>
              <p className="mt-1 text-xs font-semibold text-muted">
                Search a Voicenk ID and add your first contact.
              </p>
            </div>
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

function GuestState({
  onSignIn,
}: {
  onSignIn: () => void;
}) {
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

function UserRow({
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
        <p className="truncate text-sm font-black">
          {profile.display_name}
        </p>
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

function Avatar({
  profile,
}: {
  profile: ContactProfile;
}) {
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

function formatDate(value: string | null) {
  if (!value) return "";

  const date = new Date(value);

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
