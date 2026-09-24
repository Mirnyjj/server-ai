# Instagram Client

Transport к Graph API. Без бизнес-логики.

## Методы

**Profile / Media:** `getProfile`, `listMedia`, `getMedia`  
**Comments:** `listComments`, `listCommentReplies`, `replyToComment`, `deleteComment`  
**Content:** create*Container, `getContainerStatus`, `publishContainer`  
**Messaging:** `sendMessage`  
**Webhooks:** `subscribeToWebhooks`  
**Insights:** `getMediaInsights`, `getAccountInsights`

Version: `env.INSTAGRAM_API_VERSION`.

## ТЗ §9

Нужен `InstagramProvider` interface — Agent не должен импортировать client.
Сейчас agent вызывает client напрямую (технический долг).
