# Telegram Control Plane

Telegram — human control plane и интерфейс ручного approval.

Production использует webhook `POST /api/telegram/webhook`. Development может использовать polling. Нельзя одновременно запускать polling и webhook для одного bot token.

Telegram управляет profile selection, AI chat, system prompt, memory, knowledge base, web search, Instagram sync/connect/insights, content generation и review.

Content flow:
```
/content generate → pipeline → Post READY
→ preview + approve/regenerate/reject
→ approve → publish queue
```

Telegram preview требует public HTTPS media URL.

AI chat может собрать system prompt + memory + knowledge, запланировать web search, вызвать Luna и после ответа извлечь durable memory. Ошибка memory extraction не должна ломать основной ответ.

Авторизованы только configured Telegram chat IDs. Secrets нельзя отправлять пользователю или писать в обычные логи.