import crypto from "node:crypto";
import { env } from "../../../config/env.js";
import { prisma } from "../../../../prisma/prisma.js";
import { createInstagramClient } from "../client/instagram.client.js";
import { enqueueWebhookEvent } from "../../../infrastructure/queue/index.js";

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
   */
  function verifySignature(
    rawBody: string | Buffer,
    signatureHeader: string | undefined,
  ): boolean {
    const appSecret =
      env.INSTAGRAM_WEBHOOK_APP_SECRET ?? env.INSTAGRAM_APP_SECRET;

    if (!signatureHeader || !appSecret) {
      // In development without signature header, allow through
      if (env.NODE_ENV === "development" && !signatureHeader) {
        return true;
      }
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

  async function persistAndEnqueue(input: {
    eventId?: string | null;
    objectType: string;
    field: string;
    payload: unknown;
  }) {
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

    // Offload heavy processing to BullMQ worker
    await enqueueWebhookEvent({ webhookEventId: event.id });

    return { event, created: true };
  }

  /**
   * Fast path: verify signature → persist → enqueue.
   * Business logic runs in the webhook worker.
   */
  async function handleEvent(
    payload: unknown,
    options?: { rawBody?: string | Buffer; signature?: string },
  ) {
    if (options?.rawBody && options?.signature) {
      const valid = verifySignature(options.rawBody, options.signature);
      if (!valid) {
        throw new Error("Invalid Meta webhook signature");
      }
    } else if (options?.signature) {
      // signature present but no raw body — still try with stringified body
      const valid = verifySignature(
        options.rawBody ?? JSON.stringify(payload ?? {}),
        options.signature,
      );
      if (!valid && env.NODE_ENV === "production") {
        throw new Error("Invalid Meta webhook signature");
      }
    }

    const body = payload as MetaWebhookPayload;

    if (!body.entry?.length) {
      return { enqueued: 0 };
    }

    let enqueued = 0;

    for (const entry of body.entry) {
      if (entry.changes) {
        for (const change of entry.changes) {
          const field = change.field ?? "unknown";
          const value = change.value ?? {};

          const eventId =
            (value.id as string | undefined) ??
            (value.comment_id as string | undefined) ??
            null;

          const { created } = await persistAndEnqueue({
            eventId,
            objectType: body.object ?? "instagram",
            field,
            payload: { entry, change },
          });

          if (created) enqueued++;
        }
      }

      if (entry.messaging) {
        for (const msg of entry.messaging) {
          const mid =
            (msg.message as { mid?: string } | undefined)?.mid ?? null;

          const { created } = await persistAndEnqueue({
            eventId: mid,
            objectType: body.object ?? "instagram",
            field: "messages",
            payload: { entry, messaging: msg },
          });

          if (created) enqueued++;
        }
      }
    }

    return { enqueued };
  }

  return {
    subscribeToWebhooks,
    verifySignature,
    handleEvent,
  };
}
