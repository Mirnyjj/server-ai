# Insights Module (TZ §26–28)

## Что сделано

Сбор Instagram Insights через официальный Graph API и сохранение в `PostMetric` (flexible JSON).

### Client

- `getMediaInsights(mediaId, metrics[])`
- `getAccountInsights(userId, metrics[], { period, since, until })`

### Service

| Метод | Описание |
|-------|----------|
| `fetchMediaInsights` | Raw insights для IG media id |
| `collectPostInsights(postId)` | Fetch + `PostMetric.create` |
| `collectProfilePostInsights(profileId)` | До 50 PUBLISHED постов |
| `fetchAccountInsights` | Account-level metrics |
| `getStoredPostMetrics` | История из БД |

### Endpoints

| Method | Path |
|--------|------|
| GET | `/api/instagram/insights/media/:instagramMediaId?mediaType=` |
| POST | `/api/instagram/insights/posts/:postId/collect` |
| GET | `/api/instagram/insights/posts/:postId` |
| POST | `/api/instagram/insights/profile/collect` `{ profileId }` |
| POST | `/api/instagram/insights/profile/collect/async` → BullMQ |
| GET | `/api/instagram/insights/account?instagramUserId=&period=` |

### Метрики

Наборы в `insights.metrics.ts` по типу media (IMAGE / REELS / VIDEO / STORY).
API может не отдавать часть метрик — fallback на minimal set, флаг `partial: true`.

`PostMetric.metrics` — JSON object `{ reach: 123, likes: 45, ... }` (ТЗ §27: flexible, не fixed columns).

### Очередь

`enqueueCollectInsights({ profileId })` → worker `insights`.

## Не сделано

- Отдельная модель `AccountMetric` (ТЗ §28) — account insights пока только через API response; можно добавить migration позже
- Strategy Agent, анализирующий metrics (ТЗ §29)
