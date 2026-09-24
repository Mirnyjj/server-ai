# AI Layer — Architecture

## Model roles

| Role | Model | Responsibility |
|------|--------|----------------|
| **Brain** | **GPT-6 Luna** | Scenarios, captions, comment/DM decisions, analytics, strategy |
| **Image** | `IMAGE_GENERATOR_*` (stub\|http) | PHOTO / CAROUSEL / STORY |
| **Video** | `VIDEO_GENERATOR_*` (stub\|http) | REEL / VIDEO |

Luna does **not** render pixels. Flow:

```
Luna (scenario + visualBrief)
  → ImageGenerator | VideoGenerator
    → Object Storage (public HTTPS URL)
      → MediaAsset + Post
        → [optional] Instagram publish queue
```

## Character references

`MediaReference` + `MediaAsset` per profile.

| type | Meaning |
|------|--------|
| FACE | close-up face |
| FULL_BODY | full body |
| STYLE / OUTFIT / LOCATION / LIGHTING / REFERENCE | consistency anchors |

`metadata`: `{ description, tags[], priority, notes, locks? }`  
API: `/api/ai/profiles/:profileId/references` (+ `/pack`).

## Modules

```
ai/
  llm/          Luna client + LlmProvider
  generators/   stub + HTTP image/video
  references/   character consistency CRUD
  content/      scenarios + analytics schemas
  pipeline/     run → gen → storage → Post READY → optional publish
  plan/         scheduled content slots
  strategy/     contentStrategy updates (not Policy)
```

## Key HTTP

| Path | Action |
|------|--------|
| `POST /api/ai/scenarios/generate` | Luna scenario |
| `POST /api/ai/analytics/run` | Luna insights |
| `POST /api/ai/pipeline/run` | Full pipeline (`autoPublish?`) |
| `POST /api/ai/pipeline/posts/:id/publish` | Publish READY |
| `POST /api/ai/plan/run-slot` | One plan slot |
| `POST /api/ai/strategy/run` | Strategy agent |

## Env

```env
LUNA_API_KEY=
LUNA_BASE_URL=
LUNA_MODEL=

IMAGE_GENERATOR_PROVIDER=stub|http
IMAGE_GENERATOR_BASE_URL=
IMAGE_GENERATOR_API_KEY=
IMAGE_GENERATOR_MODEL=

VIDEO_GENERATOR_PROVIDER=stub|http
VIDEO_GENERATOR_BASE_URL=
VIDEO_GENERATOR_API_KEY=
VIDEO_GENERATOR_MODEL=
```
