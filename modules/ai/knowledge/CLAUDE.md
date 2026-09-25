# Knowledge Base

Knowledge Base хранит долговременные документы профиля и их chunks.

Основной сервис: `knowledge.service.ts`.

## Модели

- `KnowledgeDocument` — исходный документ профиля.
- `KnowledgeChunk` — фрагмент документа для поиска.

Каждая запись принадлежит `AiProfile`.

## Операции

- add document
- list documents
- delete document
- lexical search
- split into chunks

Текущий chunking использует размер около 1800 символов с overlap около 200.

Поиск сейчас lexical, не vector/RAG embeddings: текст разбивается на terms, chunks проверяются через Prisma case-insensitive contains и получают score по совпадениям.

Telegram команды `/knowledge` и `/kb` используют этот service.

Не путать Knowledge Base с AgentMemory: knowledge — документы/источники, memory — извлечённые долговременные факты и предпочтения.
