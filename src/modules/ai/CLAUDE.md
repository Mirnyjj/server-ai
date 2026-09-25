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

Current image generation uses a provider/model abstraction: the selected provider is configured through IMAGE_MODEL_PROVIDER and the concrete model through IMAGE_MODEL. fal.ai is supported as the universal model provider, allowing different fal model IDs without changing the pipeline. OpenAI and generic HTTP adapters remain available. Video remains provider/model configurable separately.

Pipeline может использовать system prompt, visual identity, MediaReference, memory, knowledge и web context. Эти источники имеют разную семантику и не должны без необходимости сливаться в один источник истины.

External provider должен получать URL, который реально доступен извне. Private/internal storage URL использовать только если provider имеет к нему доступ.