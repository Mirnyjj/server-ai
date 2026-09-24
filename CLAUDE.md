# server-ai — Autonomous AI Instagram Agent

> Branch: `fix/instagram-api-db-sync` · Updated: 2026-09-24

## AI stack (актуально)

| Роль | Модель |
|------|--------|
| Brain | **GPT-6 Luna** — сценарии, captions, analytics, agent decisions |
| Image | отдельный provider (`IMAGE_GENERATOR_*`) |
| Video | отдельный provider (`VIDEO_GENERATOR_*`) |

Anthropic **не** используется как head model.

Character refs: `MediaReference` + description → consistency pack для генерации.

---

## PROGRESS MAP

| # | Блок | Статус | % |
|---|------|--------|---|
| 1 | Meta Graph API only | ✅ | 100 |
| 2 | OAuth + tokens + refresh | ✅ | 100 |
| 3 | Local dev (MARKER) | ✅ | 100 |
| 4 | Graph client | ✅ | 100 |
| 5 | Media sync → DB | ✅ | 100 |
| 6 | Publish pipeline | ✅ | 100 |
| 7 | Container polling | ✅ | 100 |
| 8 | Webhooks | ✅ | 100 |
| 9 | Comments + reconcile | ✅ | 100 |
| 10 | DM + webhook DB | ✅ | 100 |
| 11 | Insights | ✅ | 100 |
| 12 | BullMQ (7) | ✅ | 100 |
| 13 | Policy Engine | ✅ | 100 |
| 14 | Comment/DM Agent pipeline | ✅ | 90 |
| 15 | Telegram control plane | ✅ | 85 |
| 16 | **Luna LLM client + scenarios** | ✅ | **70** |
| 17 | **Character references API** | ✅ | **80** |
| 18 | Image generator interface | ✅ stub | 40 |
| 19 | Video generator interface | ✅ stub | 40 |
| 20 | Wire agent → Luna (not stub heuristics) | ❌ | 10 |
| 21 | Full content pipeline (scenario→gen→publish) | ❌ | 15 |
| 22 | Object Storage | ❌ | 0 |
| 23 | Auto agent from webhook | ❌ | 0 |
| 24 | Strategy loop closed | ❌ | 25 |

**MVP infra ~78%** · **Full product ~58%**

---

## Character references — как заводить

```bash
POST /api/ai/profiles/:profileId/references
{
  "url": "https://cdn/.../face.jpg",
  "type": "FACE",          # FACE | FULL_BODY | STYLE | OUTFIT | LOCATION | LIGHTING | REFERENCE
  "description": "25y woman, blonde wavy hair, blue eyes, light freckles, soft smile",
  "priority": 10,
  "tags": ["primary", "front"],
  "locks": ["face", "hair"]
}
```

Pack для генерации: `GET /api/ai/profiles/:profileId/references/pack`

Рекомендация: 3–5 FACE + 1–2 FULL_BODY + STYLE/OUTFIT — иначе drift.

---

## Luna endpoints

- `POST /api/ai/scenarios/generate` `{ profileId, postType?, topicHint? }`
- `POST /api/ai/analytics/run` `{ profileId }`

---

## Next

1. Agent decisions через Luna (заменить heuristic stubs)
2. Pipeline: scenario → image/video gen → MediaAsset → publish
3. Object Storage
4. Real image/video provider adapters
