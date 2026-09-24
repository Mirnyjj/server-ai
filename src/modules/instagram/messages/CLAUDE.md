# Messages Module

## Что сделано

Отправка Direct Messages через Graph API.
Входящие DM из webhook → `DirectThread` + `DirectMessage`.

### Endpoints

| Method | Path | Body |
|--------|------|------|
| POST | `/api/instagram/messages/send` | instagramUserId, recipientId, message |

### Файлы

- `messages.routes.ts`
- `messages.service.ts` → `client.sendMessage`

## Как работает входящий DM (ТЗ §22)

```
Meta Webhook (messaging)
  → persist + enqueue
  → webhook worker
  → upsert DirectThread (instagramThreadId = sender.id)
  → upsert DirectMessage (direction=INBOUND)
```

## Не сделано (ТЗ §22–25)

- DM Agent (Claude)
- Messaging window / recipient eligibility checks
- Policy Engine
- Sensitive message escalation → Telegram
- Periodic reconciliation conversations
- Human Agent mode
