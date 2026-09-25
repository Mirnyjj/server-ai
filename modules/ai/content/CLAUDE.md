# AI Content Scenarios

Этот слой превращает тему/стратегию в структурированный сценарий контента.

- `scenario.types.ts` — типы сценария, shot/visual brief и формат контента.
- `scenario.service.ts` — генерация сценария через LLM.
- `content.routes.ts` — HTTP transport для контентных операций.

Сценарий является промежуточным контрактом между стратегией и генераторами. Он не должен напрямую зависеть от конкретного image/video provider.

Для Reel сценарий может содержать несколько shots. Каждый shot используется pipeline как отдельная сцена: изображение -> image-to-video -> итоговый FFmpeg composition.

Не помещать сюда Telegram approval, Instagram publish или provider-specific HTTP код.
