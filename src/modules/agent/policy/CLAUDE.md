# Policy Engine (TZ §21, §24–25)

## Принцип

```
Claude → structured JSON decision
  → PolicyEngine.evaluate*
    → allowed → Meta Graph API
    → denied  → escalate / ignore / log (Telegram later)
```

Claude **никогда** не вызывает Meta API напрямую.
Policy хранится на backend; prompt не может её изменить.

## Default flags (TZ example)

```ts
{
  publishContent: true,
  replyToComments: true,
  replyToMessages: true,
  deleteContent: false,
  followUsers: false,
  unfollowUsers: false,
  likeContent: false,
  sendOutboundColdMessages: false, // always false
}
```

## Sensitive categories (auto-reply forbidden)

politics, medical, legal, financial, threat, harassment,
personal_data, sexual_safety, high_risk

## API

```ts
const policy = await PolicyEngine.forProfile(profileId);

policy.can("replyToComments");
policy.evaluateCommentReply({ action, category, confidence, requiresHuman, alreadyReplied });
policy.evaluateMessageReply({ ..., withinMessagingWindow, isColdOutreach });
```

## Deny codes

POLICY_DISABLED | AUTONOMOUS_OFF | SENSITIVE_CATEGORY | LOW_CONFIDENCE |
ALREADY_REPLIED | REQUIRES_HUMAN | MESSAGING_WINDOW | COLD_OUTREACH_FORBIDDEN
