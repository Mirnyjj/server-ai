# Instagram API — Status

## Цель

Backend для AI Instagram-агента на официальном Instagram API.
Используем Instagram Login / Business Login for Instagram, не `instagrapi` и не Facebook Login.

Архитектура:

HTTP route
→ service
→ instagram.client
→ Instagram Graph API

MCP в дальнейшем будет использовать те же services, а не обращаться к Instagram API напрямую.

---

## Что уже сделано

### Instagram Client

Создан:

`src/modules/instagram/client/instagram.client.ts`

Использует:

`https://graph.instagram.com/${INSTAGRAM_API_VERSION}`

Авторизация через Bearer access token.

Реализованы методы:

- `getProfile()`
- `listMedia()`
- `listComments()`
- `listCommentReplies()`
- `replyToComment()`
- `deleteComment()`
- `createImageContainer()`
- `createVideoContainer()`
- `createReelContainer()`
- `createCarouselItemContainer()`
- `createCarouselContainer()`
- `createStoryContainer()`
- `getContainerStatus()`
- `publishContainer()`

Есть единая обработка Instagram API errors.

### Profile

Создан модуль:

```text
src/modules/instagram/profile/
├── profile.service.ts
└── profile.routes.ts

Flow:

profile.routes → profile.service → instagram.client

Endpoint:

GET /api/instagram/test/profile

Профиль успешно проверен через реальный Instagram API.

Media

Создан модуль:

src/modules/instagram/media/
├── media.service.ts
└── media.routes.ts

Endpoint:

GET /api/instagram/test/media?instagramUserId=...

Получение media успешно проверено.

Нужно добавить pagination через after.

Content

Создана структура:

src/modules/instagram/content/
├── content.routes.ts
├── content.service.ts
├── content.types.ts
├── container.service.ts
├── publish.service.ts
├── reels.service.ts
├── stories.service.ts
└── carousel.service.ts

Поддерживаются:

image
video
reel
story
carousel
container status
publish
Comments

Создан модуль:

src/modules/instagram/comments/
├── comments.service.ts
└── comments.routes.ts

Поддерживаются:

получение комментариев
получение replies
reply
delete
Webhooks

Создан:

src/modules/instagram/webhooks/
├── webhook.routes.ts
└── webhook.service.ts

Есть:

GET /api/instagram/webhook

для Meta verification.

Есть:

POST /api/instagram/webhook

для получения событий.

Сейчас verification возвращает 403 и это нужно исправить.

В .env должен быть:

INSTAGRAM_WEBHOOK_VERIFY_TOKEN=...

Webhook должен работать через публичный HTTPS URL.

Messages

Создана структура:

src/modules/instagram/messages/
├── messages.service.ts
└── messages.routes.ts

Нужно закончить реализацию отправки сообщений и обработки входящих сообщений через webhook.

Environment

Используется:

INSTAGRAM_API_VERSION=v26.0
INSTAGRAM_APP_ID=...
INSTAGRAM_APP_SECRET=...
INSTAGRAM_REDIRECT_URI=...
INSTAGRAM_MARKER=...

INSTAGRAM_MARKER — временный access token только для локальных тестов.

В production токен должен храниться в PostgreSQL в зашифрованном виде.

Что осталось
1. Webhooks — приоритет

Исправить verification 403.

Затем обработать реальные incoming events:

messages
comments
другие необходимые Instagram webhook events

Webhook должен сохранять события и передавать их дальше в application layer / queue.

2. Messages

Закончить:

получение incoming DM через webhook
определение sender.id
сохранение DirectThread
сохранение DirectMessage
sendMessage()
обработка 24h messaging window

recipientId для ответа должен приходить из webhook, а не быть захардкожен.

3. Auth

Закончить полноценный OAuth:

authorize
callback
code exchange
long-lived token
token refresh
state
сохранение Instagram account
сохранение connection
expiry/scopes/status
encryption access token

После этого убрать зависимость от INSTAGRAM_MARKER.

4. PostgreSQL

Связать API layer с существующими моделями:

InstagramAccount
InstagramConnection
MediaAsset
Post
InstagramMediaContainer
Comment
DirectThread
DirectMessage
InstagramWebhookEvent
5. Pagination

Добавить pagination для:

media
comments
replies
messages
6. Insights

Создать:

src/modules/instagram/insights/
├── insights.service.ts
└── insights.routes.ts

Добавить необходимые Instagram Insights API методы.

7. BullMQ

Добавить background jobs для:

token refresh
webhook processing
publication jobs
container status polling
retries
8. MCP

После стабилизации API layer создать тонкий MCP adapter:

MCP tool
→ service
→ instagram.client
→ Instagram API

Планируемые tools:

instagram.get_profile
instagram.list_media
instagram.publish_image
instagram.publish_reel
instagram.get_post_status
instagram.list_comments
instagram.reply_comment
instagram.list_messages
instagram.send_message
instagram.get_insights
Важные архитектурные правила
Не использовать instagrapi.
Не использовать username/password Instagram.
Не использовать Facebook Login flow.
Не обращаться к Instagram API напрямую из routes.
Routes → services → client.
Client содержит только transport/API knowledge.
Business logic находится в services.
MCP не должен дублировать Instagram API client.
Не хардкодить v26.0 — использовать env.INSTAGRAM_API_VERSION.
INSTAGRAM_MARKER используется только временно для локального тестирования.
```

1. Сохранение Instagram-аккаунта в PostgreSQL

Подключить syncInstagramAccount() к route, проверить, что InstagramAccount.upsert() создаёт или обновляет запись. Токен пока берём из INSTAGRAM_MARKER.

Следующий шаг

2. Синхронизация публикаций

Вызвать listMedia(instagramUserId), получить публикации аккаунта и сохранять их в Post. Нужны корректное сопоставление полей и защита от повторного импорта.

3. Управление контентом

Подключить создание контейнеров, проверку статуса и публикацию. Важно учитывать, что Instagram получает медиа по доступному ему URL; публикация — отдельный запрос после создания контейнера.
GitHub
+1

4. Комментарии и сообщения

Подключить получение комментариев и ответы, затем Direct API. Для входящих событий настроить вебхуки, проверку подписи и дедупликацию.

5. Автономный агент и MCP

Когда базовые операции работают через сервисы приложения, добавить бизнес-логику агента и MCP-адаптер поверх этих сервисов.
