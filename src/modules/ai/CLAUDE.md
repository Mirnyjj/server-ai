# AI Layer — Architecture

## Разделение ролей моделей

| Роль | Модель | Ответственность |
|------|--------|-----------------|
| **Brain / Orchestrator** | **GPT-6 Luna** | Сценарии контента, captions, comment/DM decisions, аналитика, strategy |
| **Image generator** | отдельная модель (настраивается) | Картинки для PHOTO / CAROUSEL / STORY |
| **Video generator** | отдельная модель (настраивается) | REEL / VIDEO |

Luna **не** генерирует пиксели. Она пишет brief → image/video provider → Object Storage → Instagram publish.

```
Luna (scenario + caption + visual brief)
  → ImageGenerator | VideoGenerator
    → MediaAsset (url)
      → Content publish pipeline
```

## Character consistency (референсы)

Для AI-персонажа пользователь загружает N фото + текстовое описание каждого.
Хранится как `MediaReference` + `MediaAsset`:

| type | Смысл |
|------|--------|
| FACE | лицо крупным планом |
| FULL_BODY | полный рост |
| STYLE | общий вайб / эстетика |
| OUTFIT | одежда |
| LOCATION | типичные локации |
| LIGHTING | свет |
| REFERENCE | прочее |

`metadata`: `{ description, tags[], priority, notes }`

При генерации Luna + ImageGenerator получают **reference pack** профиля — чтобы не было drift внешности.

## Модули

```
ai/
  llm/           # Luna client + LlmProvider interface
  generators/    # ImageGenerator / VideoGenerator interfaces
  references/    # CRUD референсов персонажа
  content/       # Content scenario (Luna output schema)
```

## Env

```env
LUNA_API_KEY=
LUNA_BASE_URL=https://...      # OpenAI-compatible endpoint
LUNA_MODEL=gpt-6-luna          # or whatever the API expects

IMAGE_GENERATOR_PROVIDER=stub  # stub | fal | replicate | custom
IMAGE_GENERATOR_API_KEY=
IMAGE_GENERATOR_MODEL=

VIDEO_GENERATOR_PROVIDER=stub
VIDEO_GENERATOR_API_KEY=
VIDEO_GENERATOR_MODEL=
```
