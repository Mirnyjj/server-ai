# Instagram Module

Instagram module — единственная application boundary для Graph API.

## Submodules
- `auth/` — OAuth, state, token exchange/refresh, account connection.
- `client/` — typed Graph API client.
- `profile/` — profile operations.
- `media/` — media synchronization.
- `content/` — containers и publishing.
- `comments/` — comments/reconciliation.
- `messages/` — Direct Messages.
- `insights/` — metrics.
- `webhooks/` — verification и event ingestion.

Flow:
```
route/service → token resolver → instagram.client → Graph API
```

AI, Telegram и MCP не должны напрямую вызывать Graph API.

Long-running work выполняется через BullMQ: webhook processing, media sync, container status, publishing, comment reconciliation, token refresh и insights.

Agent принимает decision; Instagram services выполняют API action. Это предотвращает превращение свободного LLM output в unrestricted API call.

Publishing обычно идёт: Post READY → approval/policy → publish queue → media container → status polling → published.