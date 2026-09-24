# Agent Module (TZ §18–25)

## Архитектура

```
Webhook / reconcile → Comment | DM in DB
  → POST /api/agent/comments/:id/process
  → Comment Agent
      1. load persona + post context
      2. Claude structured JSON (stub now)
      3. PolicyEngine.evaluateCommentReply
      4. if allowed → Graph API replyToComment
      5. AgentAction log
```

То же для DM: `processDirectMessage` + messaging window check.

## Файлы

| Path | Role |
|------|------|
| `policy/policy.engine.ts` | Gates all agent actions |
| `policy/policy.types.ts` | Flags, deny codes, sensitive categories |
| `comment.agent.ts` | Full comment pipeline |
| `message.agent.ts` | Full DM pipeline + 24h window |
| `claude/comment.prompt.ts` | Decision stub (→ Anthropic later) |
| `claude/message.prompt.ts` | Decision stub |
| `agent.routes.ts` | Manual trigger endpoints |
| `types.ts` | Structured decision types |

## Endpoints

| Method | Path |
|--------|------|
| GET | `/api/agent/policy/:profileId` |
| POST | `/api/agent/comments/:commentId/process` |
| POST | `/api/agent/messages/:messageId/process` |

## Claude stub → production

Сейчас heuristic stub. Когда будет `ANTHROPIC_API_KEY`:
заменить `runClaudeCommentDecision` / `runClaudeMessageDecision` на Anthropic
`tool_use` / JSON mode с тем же output schema.

## Что ещё нужно

- Wire webhook worker → auto `processComment` after upsert
- Telegram escalate for `requiresHuman`
- Real Claude prompts with full persona injection
