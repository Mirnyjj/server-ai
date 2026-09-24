# server-ai — Autonomous AI Instagram Agent

## Соответствие ТЗ

| Блок ТЗ | Статус |
|---------|--------|
| OAuth + encrypted tokens + refresh | ✅ |
| Local dev mode (без HTTPS redirect) | ✅ |
| Graph API client | ✅ |
| Profile / Media sync → DB | ✅ |
| Publish + container polling | ✅ |
| Webhooks + idempotency | ✅ |
| Comments API + reconciliation | ✅ |
| DM API + webhook → DB | ✅ |
| BullMQ (7 queues) | ✅ |
| Insights | ✅ |
| **Policy Engine** | ✅ |
| **Comment / DM Agent pipeline** | ✅ (Claude = stub) |
| Real Anthropic Claude | ❌ next |
| InstagramProvider interface | ⚠️ partial |
| Object Storage / generators | ❌ |
| Telegram control plane | ❌ |

## Agent flow

```
Comment/DM in DB
  → POST /api/agent/comments|messages/:id/process
  → Claude decision (structured JSON)
  → PolicyEngine.evaluate*
  → Graph API (if allowed)
  → AgentAction log
```

Sensitive categories → requiresHuman (no auto-reply).
DM: 24h messaging window enforced.

## Local dev

Без HTTPS redirect → MARKER mode.
`POST /api/instagram/auth/dev/bootstrap`
