# Instagram Module

## Цель

Единственная точка интеграции с Instagram через официальный Graph API.
Не используется instagrapi, username/password, private API.

## Архитектура

```
HTTP route
  → service
    → token.resolver (DB encrypted token | INSTAGRAM_MARKER)
      → instagram.client
        → graph.instagram.com/{INSTAGRAM_API_VERSION}
```

Тяжёлая обработка (webhook events, publish, token refresh, media sync) идёт через **BullMQ**.

## Подмодули

| Папка | Назначение | CLAUDE.md |
|-------|------------|-----------|
| `auth/` | OAuth, tokens, connections | да |
| `client/` | Graph API transport | да |
| `profile/` | Профиль + account sync | да |
| `media/` | List / sync media → DB | да |
| `content/` | Publish image/reel/carousel/story | да |
| `comments/` | List / reply / delete comments | да |
| `messages/` | Send DM | да |
| `webhooks/` | Meta webhook verify + enqueue | да |

## Что сделано

- OAuth flow (authorize → callback → long-lived token → encrypted DB)
- Token resolver для всех routes
- Full media sync (posts + assets + post_media) с pagination
- Content publishing pipeline + async container polling через очередь
- Webhooks: verification, HMAC signature, idempotency, enqueue
- Comments & DM API + сохранение входящих через webhook worker
- CORE MVP scopes из ТЗ

## Что НЕ сделано (см. корневой CLAUDE.md)

Insights, Comment/DM Agent, Policy Engine, Provider interface, Object Storage, Telegram.

## Env

```
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
INSTAGRAM_REDIRECT_URI=
INSTAGRAM_API_VERSION=v22.0   # или актуальная
INSTAGRAM_TOKEN_ENCRYPTION_KEY=  # min 32 chars
INSTAGRAM_WEBHOOK_VERIFY_TOKEN=
INSTAGRAM_MARKER=              # optional, dev only
INSTAGRAM_WEBHOOK_APP_SECRET=  # optional, fallback APP_SECRET
```
