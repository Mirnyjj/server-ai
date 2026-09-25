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

Current providers: OpenAI Images для image generation; fal.ai Kling V3 Pro для image-to-video; FFmpeg для composition.

Pipeline может использовать system prompt, visual identity, MediaReference, memory, knowledge и web context. Эти источники имеют разную семантику и не должны без необходимости сливаться в один источник истины.

External provider должен получать URL, который реально доступен извне. Private/internal storage URL использовать только если provider имеет к нему доступ.