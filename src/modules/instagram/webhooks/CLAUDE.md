# Webhooks Module

## Что сделано

Meta Webhooks по ТЗ §11–12:

1. **GET verification** — `hub.mode=subscribe` + `hub.verify_token` == env
2. **POST events** — signature check → persist → enqueue BullMQ
3. **Idempotency** — по `eventId` / message mid
4. **Worker** — обработка comments и messages → DB

### Endpoints

| Method | Path | Описание |
|--------|------|----------|
| GET | `/api/instagram/webhook` | Verification handshake |
| POST | `/api/instagram/webhook` | Incoming events |
| POST | `/api/instagram/webhooks/subscribe?instagramUserId=` | Subscribe app fields |

### Файлы

- `webhook.routes.ts`
- `webhook.service.ts` — verify, persist, enqueue (без тяжёлой логики)
- Worker: `infrastructure/queue/workers/webhook.worker.ts`

## Как работает

```
POST /api/instagram/webhook
  1. X-Hub-Signature-256 HMAC-SHA256 (app secret)
  2. Parse entry[].changes / entry[].messaging
  3. InstagramWebhookEvent.create (status=RECEIVED)
     — skip if eventId already exists
  4. enqueueWebhookEvent({ webhookEventId })
  5. Return 200 { enqueued }

Worker:
  status → PROCESSING
  field=comments → upsert Comment (if Post exists)
  field=messages → upsert DirectThread + DirectMessage
  status → PROCESSED | FAILED
```

## Security (ТЗ §12)

- Signature verification (production required)
- Production verification uses the exact raw HTTP body, not re-serialized JSON
- Missing production signature is rejected with HTTP 403
- Dev: signature optional if NODE_ENV=development
- Idempotency prevents double processing
- Raw payload stored in DB for replay/debug

## Env

```
INSTAGRAM_WEBHOOK_VERIFY_TOKEN=  # required for GET verify
INSTAGRAM_WEBHOOK_APP_SECRET=    # optional, else APP_SECRET
```
