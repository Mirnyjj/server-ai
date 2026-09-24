# Agent Module

## Brain = GPT-6 Luna

Comment/DM decisions: `agent/luna/*.decision.ts` → `getBrainLlm()`.
Если Luna недоступна — heuristic fallback.

```
Comment/DM in DB
  → Luna structured JSON
  → PolicyEngine
  → Graph API | Telegram escalate
```

## Endpoints

| Method | Path |
|--------|------|
| GET | `/api/agent/policy/:profileId` |
| POST | `/api/agent/comments/:commentId/process` |
| POST | `/api/agent/messages/:messageId/process` |

## Files

- `luna/comment.decision.ts` / `luna/message.decision.ts`
- `comment.agent.ts` / `message.agent.ts`
- `policy/`
