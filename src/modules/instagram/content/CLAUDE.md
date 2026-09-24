# Content Module

## Что сделано

Публикация контента через Meta media containers:
image, video, reel, carousel, story.

### Endpoints (sync path через service)

| Method | Path | Body |
|--------|------|------|
| POST | `/api/instagram/content/image` | instagramUserId, imageUrl, caption?, altText?, isAiGenerated? |
| POST | `/api/instagram/content/reel` | instagramUserId, videoUrl, caption?, isAiGenerated? |
| POST | `/api/instagram/content/carousel` | instagramUserId, items[], caption? |
| POST | `/api/instagram/content/story` | instagramUserId, imageUrl XOR videoUrl |

### Файлы

| Файл | Роль |
|------|------|
| `content.routes.ts` | Validation + token resolver + service |
| `content.service.ts` | Orchestration publishImage/Reel/Carousel/Story |
| `container.service.ts` | Create containers + `waitUntilReady` (polling) |
| `publish.service.ts` | `publishContainer` |
| `reels.service.ts` / `stories.service.ts` / `carousel.service.ts` | Type-specific helpers |
| `content.types.ts` | Input/response types |

## Как работает (sync path)

```
create container → waitUntilReady (poll status_code) → publishContainer
```

`waitUntilReady`: interval 60s, timeout 5min. Statuses: FINISHED → ok; ERROR/EXPIRED → throw.

## Async path (рекомендуется для production)

```ts
import { enqueueCreateAndPublish } from "../../../infrastructure/queue";

await enqueueCreateAndPublish({
  postId, instagramUserId, mediaType: "REEL",
  videoUrl, caption,
});
// Worker: create container → for video/reel enqueue poll → on FINISHED publish
// Updates Post.status + InstagramMediaContainer in DB
```

## Соответствие ТЗ

- §13–15 Publishing pipeline (без Object Storage / generators — URL передаётся снаружи)
- §15 Reels: async processing через container-status queue
- Stories: реализованы на уровне API; доступность endpoint зависит от account type (ТЗ §17)

## Не сделано

- Object Storage (S3/R2) — media URL должен быть публично доступен Meta
- Связка Content Plan → Claude → Visual Brief → Generator
