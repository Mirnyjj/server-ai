# Instagram Client

## Что сделано

Тонкий transport-слой к Graph API. **Без бизнес-логики.**
Все URL строятся через `env.INSTAGRAM_API_VERSION` (нет hardcoded version).

### Файлы

| Файл | Роль |
|------|------|
| `instagram.client.ts` | Factory `createInstagramClient(config)` — все HTTP methods |
| `instagram.types.ts` | Response/request types |
| `instagram.errors.ts` | `InstagramApiError` helper |
| `instagram.account.service.ts` | Sync account profile → DB (используется profile routes) |

## Методы client

**Profile / Media**
- `getProfile()`, `listMedia(userId, {after, limit})`, `getMedia(id)`

**Comments**
- `listComments(mediaId, {after, limit})`, `listCommentReplies`, `replyToComment`, `deleteComment`

**Content**
- `createImageContainer`, `createVideoContainer`, `createReelContainer`
- `createStoryContainer`, `createCarouselItemContainer`, `createCarouselContainer`
- `getContainerStatus`, `publishContainer`

**Messaging**
- `sendMessage(userId, recipientId, text)`

**Webhooks**
- `subscribeToWebhooks(userId, fields[])`

## Как работает

```ts
const client = createInstagramClient({
  accessToken,
  apiVersion: env.INSTAGRAM_API_VERSION, // e.g. "v22.0"
});
// baseUrl = https://graph.instagram.com/{apiVersion}
// Authorization: Bearer {accessToken}
```

Ошибки Graph API → `createInstagramApiError(message, status, details)`.

## Важно (ТЗ §9)

Agent **не должен** вызывать client напрямую.
В будущем нужен `InstagramProvider` interface; client — одна из реализаций.
Пока services вызывают client напрямую (промежуточный этап).
