# Instagram Module

## Архитектура

```
HTTP route → service → token.resolver → instagram.client → Graph API
Тяжёлое → BullMQ workers
```

## Подмодули

| Папка | Статус |
|-------|--------|
| `auth/` | ✅ OAuth + dev bootstrap |
| `client/` | ✅ + insights methods |
| `profile/` | ✅ |
| `media/` | ✅ sync → DB |
| `content/` | ✅ publish pipeline |
| `comments/` | ✅ API + reconciliation |
| `messages/` | ✅ send DM |
| `webhooks/` | ✅ verify + queue |
| `insights/` | ✅ PostMetric |

## Связь с Agent

Agent (`modules/agent`) использует client + PolicyEngine.
Webhook worker **ещё не** вызывает agent автоматически.

## Local dev

`isInstagramDevMode()` → MARKER, без OAuth/webhooks.

## Не в этом модуле (ТЗ)

Object Storage, generators, InstagramProvider interface, Telegram.
