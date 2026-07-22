import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { getSupabaseConfig } from "@/lib/supabase/config";

export const runtime = "nodejs";
export const maxDuration = 60;

type MessageWebhookPayload = {
  type?: string;
  table?: string;
  record?: {
    id?: string;
    conversation_id?: string;
    sender_id?: string;
  };
};

export async function POST(request: NextRequest) {
  try {
    const expectedSecret =
      process.env.PUSH_WEBHOOK_SECRET?.trim();

    const suppliedSecret =
      request.headers
        .get("x-voicenk-webhook-secret")
        ?.trim();

    if (
      !expectedSecret ||
      !suppliedSecret ||
      suppliedSecret !== expectedSecret
    ) {
      return NextResponse.json(
        { error: "Unauthorized webhook." },
        { status: 401 },
      );
    }

    const payload =
      (await request.json()) as MessageWebhookPayload;

    if (
      payload.table !== "messages" ||
      payload.type !== "INSERT"
    ) {
      return NextResponse.json({
        success: true,
        skipped: true,
      });
    }

    const conversationId =
      payload.record?.conversation_id;
    const senderId = payload.record?.sender_id;

    if (!conversationId || !senderId) {
      return NextResponse.json(
        { error: "Invalid message webhook payload." },
        { status: 400 },
      );
    }

    const secretKey =
      process.env.SUPABASE_SECRET_KEY?.trim() ||
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    const vapidPublicKey =
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
    const vapidPrivateKey =
      process.env.VAPID_PRIVATE_KEY?.trim();
    const vapidSubject =
      process.env.VAPID_SUBJECT?.trim() ||
      "mailto:support@voicenk.com";

    if (
      !secretKey ||
      !vapidPublicKey ||
      !vapidPrivateKey
    ) {
      return NextResponse.json(
        {
          error:
            "Push notification server variables are incomplete.",
        },
        { status: 500 },
      );
    }

    const { url } = getSupabaseConfig();
    const admin = createAdminClient(url, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const [
      { data: members, error: membersError },
      { data: sender, error: senderError },
    ] = await Promise.all([
      admin
        .from("conversation_members")
        .select("user_id")
        .eq("conversation_id", conversationId)
        .neq("user_id", senderId),
      admin
        .from("profiles")
        .select("display_name")
        .eq("id", senderId)
        .maybeSingle(),
    ]);

    if (membersError) throw membersError;
    if (senderError) throw senderError;

    const recipientIds =
      (members ?? []).map((item) => item.user_id);

    if (recipientIds.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
      });
    }

    const { data: subscriptions, error: subsError } =
      await admin
        .from("push_subscriptions")
        .select("id,endpoint,p256dh,auth")
        .in("user_id", recipientIds)
        .eq("enabled", true);

    if (subsError) throw subsError;

    webpush.setVapidDetails(
      vapidSubject,
      vapidPublicKey,
      vapidPrivateKey,
    );

    const notificationPayload = JSON.stringify({
      title: "VoiceNK",
      body: `New voice message from ${
        sender?.display_name ?? "a contact"
      }`,
      conversationId,
      url: "/?tab=messages",
      tag: `conversation-${conversationId}`,
    });

    let sent = 0;
    const expiredSubscriptionIds: string[] = [];

    await Promise.all(
      (subscriptions ?? []).map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth,
              },
            },
            notificationPayload,
            {
              TTL: 3600,
              urgency: "high",
              topic: `msg-${conversationId}`.slice(0, 32),
            },
          );

          sent += 1;
        } catch (pushError) {
          const statusCode =
            typeof pushError === "object" &&
            pushError &&
            "statusCode" in pushError
              ? Number(pushError.statusCode)
              : 0;

          if (statusCode === 404 || statusCode === 410) {
            expiredSubscriptionIds.push(subscription.id);
            return;
          }

          console.error(
            "VoiceNK push delivery failed:",
            pushError,
          );
        }
      }),
    );

    if (expiredSubscriptionIds.length > 0) {
      await admin
        .from("push_subscriptions")
        .delete()
        .in("id", expiredSubscriptionIds);
    }

    return NextResponse.json({
      success: true,
      sent,
      removedExpired:
        expiredSubscriptionIds.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Push notification failed.",
      },
      { status: 500 },
    );
  }
}
