# server-ai — Project Context for Coding Agents

## Назначение
Backend AI-агента для управления Instagram: Graph API/OAuth, Luna LLM, генерация изображений и видео, контент-пайплайн, память, Knowledge Base, Telegram control plane, MCP, BullMQ/Redis, PostgreSQL/Prisma, Object Storage, SearXNG и Whisper.

## Source of truth
Текущий runtime-код находится в `src/`. Главные точки входа: `src/index.ts`, `src/app.ts`, `src/worker.ts`, `src/mcp/server.ts`. Схема БД: `prisma/schema.prisma`. Docker topology: `docker-compose.yml`.

В репозитории также существуют top-level `modules/`, `infrastructure/` и `lib/`. Это legacy/parallel tree от предыдущей архитектуры. Не переносить код между ним и `src/` автоматически. Перед изменением проверить реальный import path.

## Архитектура
```
REST / Telegram / MCP / Instagram Webhooks
                  ↓
        services / agents / pipeline
                  ↓
 Prisma / Redis / Instagram / LLM / generators / storage
                  ↓
              external APIs
```
Transport layer не должен содержать дублирующую бизнес-логику. Telegram и MCP должны переиспользовать существующие services/tool executor.

## Домены
- `src/modules/ai` — LLM, сценарии, стратегия, память, knowledge, search, генераторы.
- `src/modules/instagram` — OAuth, Graph API, media, content, comments, DM, insights, webhooks.
- `src/modules/agent` — decision/policy для comments и DM.
- `src/modules/telegram` — управление агентом и human approval.
- `src/mcp` — MCP stdio + Streamable HTTP.
- `src/infrastructure` — Prisma, Redis, BullMQ, Object Storage.

## Content flow
```
strategy/topic → Luna scenario → content pipeline
→ image/video generation → Object Storage → Post READY
→ Telegram review → APPROVED → publish queue → Instagram
```
Reel сейчас: Luna создаёт shots → image generator создаёт frame → video generator делает image-to-video → FFmpeg объединяет сцены в MP4.

Текущие media providers: OpenAI Images (`gpt-image-2`) и fal.ai Kling V3 Pro image-to-video. OpenAI Sora/Videos API не использовать.

## LLM
Consumers работают через `LlmProvider`. Основные операции: `completeText` и `completeJson`. Luna — текущий brain provider. LLM output не является источником истины для БД; structured output валидируется вызывающим кодом.

System prompt, AgentMemory и Knowledge Base — разные механизмы: prompt задаёт поведение, memory хранит durable facts/preferences, knowledge хранит source documents/chunks.

## Queue
BullMQ + Redis используются для долгих и фоновых операций. HTTP/Telegram не должны ждать тяжёлую генерацию. Jobs должны быть retry-safe и idempotent; секреты нельзя класть в payload.

## Database
`prisma/schema.prisma` — source of truth. Runtime использует `DATABASE_URL`, migrations — `DIRECT_URL`. Generated Prisma files не редактировать вручную.

После изменения schema: migration → Prisma generate → исправление TypeScript consumers → build.

## Storage
Object Storage находится в `src/infrastructure/storage`. Внешним AI providers и Telegram нужны реально доступные HTTPS URLs; internal Docker hostname не подходит.

## Правила агента
1. Перед изменением читать этот файл и ближайший `CLAUDE.md`.
2. Читать target file и его direct consumers.
3. Для DB изменений сверяться с Prisma schema.
4. Для queue изменений сверять producer, worker и payload types.
5. Не придумывать отсутствующие API, env, модели или функции.
6. Не использовать `any` для обхода type errors.
7. Provider-specific код держать за интерфейсами.
8. При изменении поведения обновлять ближайший `CLAUDE.md`.

## Проверка
Обычная проверка: `npm run build`. Для Docker: `docker compose config`, `docker compose build`, `docker compose up -d`, `docker compose ps`.

Документация предназначена как persistent context для coding agents и должна описывать фактическое поведение кода, а не желаемую архитектуру.