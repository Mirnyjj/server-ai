# Messages Module

## Graph API

`POST /api/instagram/messages/send` `{ instagramUserId, recipientId, message }`

## Webhook → DB

Messaging events → `DirectThread` + `DirectMessage` (INBOUND).

## Agent

`POST /api/agent/messages/:messageId/process` — DM Agent + Policy + 24h window.

## Не сделано

- Auto-trigger agent from webhook worker
- Periodic conversation reconciliation
- Telegram escalate for requiresHuman
