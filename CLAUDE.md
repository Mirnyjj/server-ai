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
        Agent Orchestrator / domain services
                  ↓
        specialized agents / pipelines
                  ↓
 Prisma / Redis / Instagram / LLM / generators / storage
                  ↓
              external APIs
```

Специализированные агенты находятся в `src/modules/agents`:
- `platform` — административная и техническая ответственность.
- `content` — контент и генерация.
- `analytics` — аналитика и стратегия.
- `community` — комментарии и Direct.

Orchestrator маршрутизирует запрос к одной роли. Каждый специализированный агент имеет детерминированный allowlist инструментов. LLM не может расширить собственные полномочия.

Transport layer не должен содержать дублирующую бизнес-логику. Telegram и MCP должны переиспользовать существующие services/tool executor.

## Landing

The public `GET /` route is served by `src/modules/landing/landing.routes.ts` as a self-contained responsive landing page with an animated atlas. API, MCP and existing application routes are not replaced by the landing module. HTTPS termination remains the responsibility of the reverse proxy.

## Домены
- `src/modules/ai` — LLM, сценарии, стратегия, память, knowledge, search, генераторы.
- `src/modules/agents` — специализированные AI-агенты и маршрутизация.
- `src/modules/instagram` — OAuth, Graph API, media, content, comments, DM, insights, webhooks.
- `src/modules/agent` — decision/policy для comments и DM.
- `src/modules/telegram` — управление агентами и human approval.
- `src/mcp` — MCP stdio + Streamable HTTP.
- `src/infrastructure` — Prisma, Redis, BullMQ, Object Storage.

## Agent responsibilities
```
                     Agent Orchestrator
                              │
        ┌─────────────┬───────┼────────────┬─────────────┐
        ▼             ▼       ▼            ▼
    Platform       Content  Analytics   Community
        │             │       │            │
    platform       content  insights     comments/DM
      tools          tools    tools         tools
```

Agent boundaries are enforced in code through `AGENT_TOOLSETS` and `isToolAllowed`. Добавление нового tool требует явного определения владельца-роли и обновления документации.

## Content flow
```
strategy/topic → Luna scenario → content pipeline
→ image/video generation → Object Storage → Post READY
→ Telegram review → APPROVED → publish queue → Instagram
```
Reel сейчас: Luna создаёт shots → image generator создаёт frame → video generator делает image-to-video → FFmpeg объединяет сцены в MP4.

Image generation uses the generic ImageGenerator interface and one universal Responses API HTTP adapter. IMAGE_MODEL_API_KEY, IMAGE_MODEL_BASE_URL and IMAGE_MODEL select credentials, endpoint and concrete image model; IMAGE_MAIN_MODEL optionally selects the top-level Responses model and otherwise LUNA_MODEL is used. The adapter invokes the `image_generation` tool and returns base64 image data to the storage layer. The pipeline does not contain provider-specific image routing. Video generation remains separately configurable. OpenAI Sora/Videos API не использовать.

## LLM
Consumers работают через `LlmProvider`. Основные операции: `completeText` и `completeJson`. Luna — текущий brain provider. LLM output не является источником истины для БД; structured output валидируется вызывающим кодом.

System prompt, AgentMemory и Knowledge Base — разные механизмы: prompt задаёт поведение, memory хранит durable facts/preferences, knowledge хранит source documents/chunks.

## Queue
BullMQ + Redis используются для долгих и фоновых операций. HTTP/Telegram не должны ждать тяжёлую генерацию. Jobs должны быть retry-safe и idempotent; секреты нельзя класть в payload.

## Database
`prisma/schema.prisma` — source of truth. Runtime использует `DATABASE_URL`, migrations — `DIRECT_URL`. Generated Prisma files не редактировать вручную.

После изменения schema: migration → Prisma generate → исправление TypeScript consumers → build.

## Docker Compose
`docker-compose.yml` is the production-local topology for API, Redis, Whisper and SearXNG. Redis is internal-only and must not publish port `6379` to the host. API is the only service published directly by Compose on port `8000`; external HTTPS termination belongs to the reverse proxy.

## Storage
Object Storage находится в `src/infrastructure/storage`. Внешним AI providers и Telegram нужны реально доступные HTTPS URLs; internal Docker hostname не подходит.

## ОБЯЗАТЕЛЬНОЕ ПРАВИЛО ДОКУМЕНТАЦИИ

Любой coding agent, человек или автоматизация, которые вносят изменения в репозиторий, ОБЯЗАНЫ одновременно поддерживать документацию в актуальном состоянии.

Документация является частью изменения кода, а не отдельной задачей.

Перед началом работы:
1. Прочитать корневой `CLAUDE.md`.
2. Прочитать ближайший `CLAUDE.md` в изменяемой директории.
3. Если ближайшего `CLAUDE.md` нет — создать его, если директория содержит самостоятельную значимую бизнес- или инфраструктурную логику.
4. Определить, какие архитектурные документы затрагивает предполагаемое изменение.

После изменения:
1. Проверить, изменилось ли фактическое поведение кода.
2. Если изменилось — ОБЯЗАТЕЛЬНО обновить соответствующий `CLAUDE.md`.
3. Если появился новый значимый модуль/директория — создать для него `CLAUDE.md`.
4. Если изменились зависимости между модулями, data flow, env variables, API endpoints, queue payloads, Prisma models, provider contracts, worker behavior или deployment behavior — обновить документацию всех затронутых уровней.
5. Удалить из документации устаревшие утверждения. Не оставлять описание старого поведения рядом с новым.
6. Документировать фактическую реализацию, а не планы или предположения.
7. Не считать задачу завершённой, пока код и документация не соответствуют друг другу.

### Правило изменения кода и документации

Каждый change должен рассматриваться как пара:

```
CODE CHANGE
    +
DOCUMENTATION CHANGE
    =
COMPLETE CHANGE
```

Если изменение не влияет на поведение, архитектуру или публичный контракт, отдельное изменение документации может не требоваться. Например: форматирование, переименование локальной переменной без изменения смысла или исправление очевидной опечатки.

Во всех остальных случаях отсутствие обновления документации считается незавершённой работой.

### Что обязательно документировать

При изменении:

- API route → обновить route/domain documentation.
- Telegram command/callback → обновить Telegram documentation.
- MCP tool → обновить MCP documentation.
- Prisma model/field/relation/enum → обновить DB-related documentation.
- Queue/job/worker → обновить queue documentation.
- AI pipeline → обновить AI/pipeline documentation.
- LLM provider/prompt contract → обновить LLM documentation.
- Image/video provider → обновить generator documentation.
- Storage → обновить storage documentation.
- Environment variable → обновить соответствующий `CLAUDE.md` и при необходимости root documentation.
- Docker/Compose/deployment → обновить infrastructure/deployment documentation.
- Новый агент/роль/allowlist → обновить `src/modules/agents/CLAUDE.md` и root architecture.
- Новый модуль → создать `CLAUDE.md` в его директории.
- Удаление функциональности → удалить соответствующее устаревшее описание из документации.

### Перед commit

Перед созданием commit агент обязан проверить:

```
git diff
git status
```

и отдельно убедиться, что документация отражает изменения.

Если изменён код, но документация должна была измениться и не изменилась, агент должен остановиться и исправить документацию до commit.

## Правила агента
1. Перед изменением читать этот файл и ближайший `CLAUDE.md`.
2. Читать target file и его direct consumers.
3. Для DB изменений сверяться с Prisma schema.
4. Для queue изменений сверять producer, worker и payload types.
5. Не придумывать отсутствующие API, env, модели или функции.
6. Не использовать `any` для обхода type errors.
7. Provider-specific код держать за интерфейсами.
8. Любое значимое изменение кода сопровождать обновлением документации.
9. Устаревшую документацию удалять или исправлять, а не оставлять как историческое описание текущего поведения.
10. Не считать работу завершённой, пока code + docs согласованы.

### Docker build
Production Docker build использует `npm ci`, поэтому `package-lock.json` должен быть синхронизирован с `package.json`. После добавления или изменения dependency сначала обновлять lockfile локальным `npm install`, затем проверять `npm ci`/Docker build. Не возвращать `npm install` в production Dockerfile.

## Проверка
Обычная проверка: `npm run build`. Для Docker: `docker compose config`, `docker compose build`, `docker compose up -d`, `docker compose ps`.

Документация предназначена как persistent context для coding agents и должна описывать фактическое поведение кода, а не желаемую архитектуру.
