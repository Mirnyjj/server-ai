# BullMQ Queues

## Queues

| Queue | Purpose |
|-------|---------|
| `token-refresh` | Refresh long-lived Instagram tokens |
| `webhook` | Process Meta webhook events (comments, DMs) |
| `publish` | Create media containers & publish posts |
| `container-status` | Poll Instagram container processing status |
| `media-sync` | Import existing Instagram media into DB |

## Jobs

### token-refresh
- `refresh-connection` — refresh one account
- `refresh-all-expiring` — refresh all tokens expiring within N hours (repeatable every 6h)

### webhook
- `process-webhook-event` — process a persisted `InstagramWebhookEvent`

### publish
- `publish-post` — publish an already-created container
- `create-and-publish` — create container + publish (or schedule poll for video/reel)

### container-status
- `poll-container` — check status; re-queue or enqueue publish

### media-sync
- `sync-account-media` — full media import for a profile

## Usage

```ts
import {
  enqueueTokenRefresh,
  enqueueWebhookEvent,
  enqueueCreateAndPublish,
  enqueueMediaSync,
} from "./infrastructure/queue";

await enqueueCreateAndPublish({
  postId: "…",
  instagramUserId: "…",
  mediaType: "IMAGE",
  imageUrl: "https://…",
  caption: "Hello",
});
```

## Running

Workers start automatically with the API (`npm run dev`).

Standalone worker process:

```bash
npm run worker        # production-like
npm run worker:dev    # with watch
```

Requires Redis (`docker compose up -d redis`) and `REDIS_URL` in `.env`.
