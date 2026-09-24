import crypto from "node:crypto";
import { env } from "../../../config/env";
import { prisma } from "../../../../prisma/prisma";
import { createInstagramClient } from "../client/instagram.client";
import { MessageDirection } from "../../../generated/prisma/enums";

type MetaWebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    time?: number;
    changes?: Array<{
      field?: string;
      value?: Record<string, unknown>;
    }>;
    messaging?: Array<Record<string, unknown>>;
  }>;
};

export function createInstagramWebhookService(accessToken?: string) {
  const token = accessToken ?? env.INSTAGRAM_MARKER;

  const instagramClient = token
    ? createInstagramClient({
        accessToken: token,
        apiVersion: env.INSTAGRAM_API_VERSION,
      })
    : null;

  async function subscribeToWebhooks(instagramUserId: string) {
    if (!instagramClient) {
      throw new Error("Instagram client is not configured (no access token)");
    }

    return instagramClient.subscribeToWebhooks(instagramUserId, [
      "comments",
      "messages",
      "mentions",
    ]);
  }

  /**
   * Verifies X-Hub-Signature-256 from Meta.
   * @see https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
   */
  function verifySignature(
    rawBody: string | Buffer,
    signatureHeader: string | undefined,
  ): boolean {
    const appSecret =
      env.INSTAGRAM_WEBHOOK_APP_SECRET ?? env.INSTAGRAM_APP_SECRET;

    if (!signatureHeader || !appSecret) {
      return false;
    }

    const expected =
      "sha256=" +
      crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signatureHeader),
        Buffer.from(expected),
      );
    } catch {
      return false;
    }
  }

  async function persistWebhookEvent(input: {
    eventId?: string | null;
    objectType: string;
    field: string;
    payload: unknown;
  }) {
    // Idempotency: skip if we already have this eventId
    if (input.eventId) {
      const existing = await prisma.instagramWebhookEvent.findFirst({
        where: { eventId: input.eventId },
      });

      if (existing) {
        return { event: existing, created: false };
      }
    }

    const event = await prisma.instagramWebhookEvent.create({
      data: {
        eventId: input.eventId ?? null,
        objectType: input.objectType,
        field: input.field,
        payload: input.payload as object,
        status: "RECEIVED",
      },
    });

    return { event, created: true };
  }

  async function processCommentChange(
    igAccountId: string | undefined,
    value: Record<string, unknown>,
  ) {
    const mediaId = String(value.media?.id ?? value.media_id ?? "");
    const commentId = String(value.id ?? value.comment_id ?? "");
    const text = String(value.text ?? "");
    const username =
      (value.from as { username?: string } | undefined)?.username ??
      (value.username as string | undefined) ??
      null;

    if (!commentId || !mediaId) {
      return;
    }

    const post = await prisma.post.findUnique({
      where: { instagramMediaId: mediaId },
    });

    if (!post) {
      // Post not yet synced — store only webhook event for later processing
      return;
    }

    await prisma.comment.upsert({
      where: { instagramId: commentId },
      create: {
        instagramId: commentId,
        username,
        text,
        postId: post.id,
        replied: false,
        requiresHuman: false,
      },
      update: {
        text,
        username,
      },
    });
  }

  async function processMessagingEvent(
    entryId: string | undefined,
    messaging: Record<string, unknown>,
  ) {
    const sender = messaging.sender as { id?: string } | undefined;
    const recipient = messaging.recipient as { id?: string } | undefined;
    const message = messaging.message as
      | { mid?: string; text?: string }
      | undefined;

    if (!message?.mid || !sender?.id) {
      return;
    }

    // entry.id is usually the Instagram Business Account ID
    const account = entryId
      ? await prisma.instagramAccount.findUnique({
          where: { instagramUserId: entryId },
        })
      : null;

    if (!account) {
      return;
    }

    const thread = await prisma.directThread.upsert({
      where: { instagramThreadId: sender.id },
      create: {
        instagramThreadId: sender.id,
        accountId: account.id,
        username: null,
      },
      update: {},
    });

    await prisma.directMessage.upsert({
      where: { instagramMessageId: message.mid },
      create: {
        instagramMessageId: message.mid,
        threadId: thread.id,
        text: message.text ?? "",
        direction: MessageDirection.INBOUND,
        replied: false,
        requiresHuman: false,
      },
      update: {
        text: message.text ?? "",
      },
    });
  }

  async function handleEvent(
    payload: unknown,
    options?: { rawBody?: string | Buffer; signature?: string },
  ) {
    // Signature check (skip in development if no secret configured)
    if (options?.rawBody && options?.signature) {
      const valid = verifySignature(options.rawBody, options.signature);
      if (!valid) {
        throw new Error("Invalid Meta webhook signature");
      }
    }

    const body = payload as MetaWebhookPayload;

    if (!body.entry?.length) {
      return { processed: 0 };
    }

    let processed = 0;

    for (const entry of body.entry) {
      // Changes (comments, mentions, etc.)
      if (entry.changes) {
        for (const change of entry.changes) {
          const field = change.field ?? "unknown";
          const value = change.value ?? {};

          const eventId =
            (value.id as string | undefined) ??
            (value.comment_id as string | undefined) ??
            null;

          const { created } = await persistWebhookEvent({
            eventId,
            objectType: body.object ?? "instagram",
            field,
            payload: { entry, change },
          });

          if (!created) {
            continue; // already processed
          }

          if (field === "comments") {
            await processCommentChange(entry.id, value);
          }

          processed++;

          await prisma.instagramWebhookEvent.updateMany({
            where: { eventId: eventId ?? undefined, status: "RECEIVED" },
            data: { status: "PROCESSED", processedAt: new Date() },
          });
        }
      }

      // Messaging (DM)
      if (entry.messaging) {
        for (const msg of entry.messaging) {
          const mid =
            (msg.message as { mid?: string } | undefined)?.mid ?? null;

          const { created } = await persistWebhookEvent({
            eventId: mid,
            objectType: body.object ?? "instagram",
            field: "messages",
            payload: { entry, messaging: msg },
          });

          if (!created) {
            continue;
          }

          await processMessagingEvent(entry.id, msg);
          processed++;

          if (mid) {
            await prisma.instagramWebhookEvent.updateMany({
              where: { eventId: mid, status: "RECEIVED" },
              data: { status: "PROCESSED", processedAt: new Date() },
            });
          }
        }
      }
    }

    return { processed };
  }

  return {
    subscribeToWebhooks,
    verifySignature,
    handleEvent,
  };
}
