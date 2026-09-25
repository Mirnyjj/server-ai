import { Worker, type Job } from "bullmq";
import { getBullMqConnection } from "../connection.js";
import { QUEUE_NAMES, JOB_NAMES } from "../types.js";
import type { ProcessWebhookEventJobData } from "../types.js";
import { prisma } from "../../../../prisma/prisma.js";
import { MessageDirection } from "../../../generated/prisma/enums.js";
import {
  enqueueProcessComment,
  enqueueProcessDirectMessage,
} from "../queues.js";

async function processWebhookEvent(job: Job<ProcessWebhookEventJobData>) {
  const { webhookEventId } = job.data;

  const event = await prisma.instagramWebhookEvent.findUnique({
    where: { id: webhookEventId },
  });

  if (!event) {
    throw new Error(`WebhookEvent ${webhookEventId} not found`);
  }

  if (event.status === "PROCESSED") {
    job.log("Already processed — skipping");
    return { skipped: true };
  }

  await prisma.instagramWebhookEvent.update({
    where: { id: webhookEventId },
    data: { status: "PROCESSING" },
  });

  try {
    const payload = event.payload as {
      entry?: {
        id?: string;
        changes?: Array<{ field?: string; value?: Record<string, unknown> }>;
        messaging?: Array<Record<string, unknown>>;
      };
      change?: { field?: string; value?: Record<string, unknown> };
      messaging?: Record<string, unknown>;
    };

    const field = event.field;
    let enqueuedAgent = false;

    if (field === "comments") {
      const value =
        payload.change?.value ??
        (payload.entry as { changes?: Array<{ value?: Record<string, unknown> }> })
          ?.changes?.[0]?.value ??
        {};

      const mediaId = String(
        (value.media as { id?: string } | undefined)?.id ??
          value.media_id ??
          "",
      );
      const commentId = String(value.id ?? value.comment_id ?? "");
      const text = String(value.text ?? "");
      const username =
        (value.from as { username?: string } | undefined)?.username ??
        (value.username as string | undefined) ??
        null;

      if (commentId && mediaId) {
        const post = await prisma.post.findUnique({
          where: { instagramMediaId: mediaId },
        });

        if (post) {
          const comment = await prisma.comment.upsert({
            where: { instagramId: commentId },
            create: {
              instagramId: commentId,
              username,
              text,
              postId: post.id,
              replied: false,
              requiresHuman: false,
            },
            update: { text, username },
          });
          job.log(`Upserted comment ${commentId} for post ${post.id}`);

          // Autonomous: Luna agent via queue
          await enqueueProcessComment({ commentId: comment.id });
          enqueuedAgent = true;
          job.log(`Enqueued agent process-comment ${comment.id}`);
        } else {
          job.log(`Post for media ${mediaId} not found — comment deferred`);
        }
      }
    }

    if (field === "messages") {
      const messaging =
        payload.messaging ??
        (payload.entry as { messaging?: Array<Record<string, unknown>> })
          ?.messaging?.[0] ??
        {};

      const sender = messaging.sender as { id?: string } | undefined;
      const message = messaging.message as
        | { mid?: string; text?: string }
        | undefined;

      const entryId =
        (payload.entry as { id?: string } | undefined)?.id ??
        event.objectType;

      if (message?.mid && sender?.id && entryId) {
        const account = await prisma.instagramAccount.findUnique({
          where: { instagramUserId: entryId },
        });

        if (account) {
          const thread = await prisma.directThread.upsert({
            where: { instagramThreadId: sender.id },
            create: {
              instagramThreadId: sender.id,
              accountId: account.id,
              username: null,
            },
            update: {},
          });

          const dm = await prisma.directMessage.upsert({
            where: { instagramMessageId: message.mid },
            create: {
              instagramMessageId: message.mid,
              threadId: thread.id,
              text: message.text ?? "",
              direction: MessageDirection.INBOUND,
              replied: false,
              requiresHuman: false,
            },
            update: { text: message.text ?? "" },
          });

          job.log(`Upserted DM ${message.mid} from ${sender.id}`);

          await enqueueProcessDirectMessage({ messageId: dm.id });
          enqueuedAgent = true;
          job.log(`Enqueued agent process-dm ${dm.id}`);
        }
      }
    }

    await prisma.instagramWebhookEvent.update({
      where: { id: webhookEventId },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
        error: null,
      },
    });

    return { processed: true, field, enqueuedAgent };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Webhook processing failed";

    await prisma.instagramWebhookEvent.update({
      where: { id: webhookEventId },
      data: {
        status: "FAILED",
        error: message,
      },
    });

    throw error;
  }
}

export function createWebhookWorker() {
  const worker = new Worker(
    QUEUE_NAMES.WEBHOOK,
    async (job) => {
      if (job.name !== JOB_NAMES.PROCESS_WEBHOOK_EVENT) {
        throw new Error(`Unknown job name: ${job.name}`);
      }
      return processWebhookEvent(job as Job<ProcessWebhookEventJobData>);
    },
    {
      connection: getBullMqConnection(),
      concurrency: 5,
    },
  );

  worker.on("completed", (job) => {
    console.log(`[webhook] completed ${job.id}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[webhook] failed ${job?.id}:`, err.message);
  });

  return worker;
}
