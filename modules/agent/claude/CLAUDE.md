# Claude Agent Prompts

Здесь находятся prompt builders для Claude-ветки агентской логики.

- `comment.prompt.ts` формирует контекст для обработки Instagram комментария.
- `message.prompt.ts` формирует контекст для обработки Direct Message.

Prompt отвечает только за формирование инструкции/контекста. Решение о действии находится в соответствующем agent/decision слое.

При изменении prompt сохранять строгий контракт с parser/decision logic. Не добавлять в prompt обещания возможностей, которых нет в коде.
