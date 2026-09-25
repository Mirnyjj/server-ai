# AI Module

AI module отвечает за reasoning и media generation.

## Submodules
- `llm/` — LlmProvider и Luna.
- `content/` — структурированные content scenarios.
- `pipeline/` — полный generation flow.
- `generators/` — image/video providers и FFmpeg.
- `references/` — character/visual references.
- `memory/` — durable profile memory.
- `knowledge/` — documents/chunks.
- `plan/` — content planning.
- `strategy/` — strategy agent.
- `search/` — SearXNG.
- `transcription/` — Whisper adapter.

## Flow
```
Luna → scenario → pipeline → generators → Object Storage → Post/MediaAsset
```
Luna не рендерит media. Image и Video — отдельные interfaces.

Image generation uses one universal OpenAI-compatible HTTP adapter. The model is configured independently through IMAGE_MODEL, while IMAGE_MODEL_API_KEY and IMAGE_MODEL_BASE_URL define the credentials and API endpoint. The endpoint must expose /images/generations. This allows changing image models/providers without changing the content pipeline. Video remains separately configurable.

Pipeline может использовать system prompt, visual identity, MediaReference, memory, knowledge и web context. Эти источники имеют разную семантику и не должны без необходимости сливаться в один источник истины.

External provider должен получать URL, который реально доступен извне. Private/internal storage URL использовать только если provider имеет к нему доступ.