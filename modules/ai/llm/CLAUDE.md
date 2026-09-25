# LLM Layer

Папка содержит абстракцию LLM provider.

## Контракт

`types.ts` определяет:

- `LlmMessage`
- `LlmJsonRequest`
- `LlmJsonResponse`
- `LlmProvider`

Provider обязан поддерживать `completeJson` и `completeText`.

## Luna

`luna.client.ts` — HTTP client для Chat Completions-compatible endpoint.

`provider.ts` выбирает и предоставляет singleton brain LLM через `getBrainLlm()`.

Текущие env:

- `LUNA_API_KEY`
- `LUNA_BASE_URL`
- `LUNA_MODEL`

## Правила

JSON responses должны быть валидируемыми на уровне вызывающего кода. LLM нельзя считать источником истины для database state.

Не смешивать LLM transport с Telegram/Instagram бизнес-логикой.

Если добавляется новый provider, реализовать интерфейс `LlmProvider`, а не менять consumers под конкретный SDK.
