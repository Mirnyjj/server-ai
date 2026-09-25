# Agent Memory

Memory layer хранит долговременные сведения, которые агент может использовать между Telegram диалогами.

- `memory.service.ts` — CRUD/search для `AgentMemory`.
- `memory.extractor.ts` — извлекает durable facts из диалога через LLM.

Память принадлежит `AiProfile`.

После ответа Telegram AI extractor пытается выделить полезные факты: preferences, strategy, audience и другие durable сведения. Ошибка extraction не должна ломать основной ответ пользователю.

Сервис дедуплицирует одинаковый текст в рамках profile/type и может обновлять importance.

Команды Telegram:

- `/memory`
- `/memory add`
- `/memory search`
- `/memory forget`

Не записывать в memory временный conversational noise. System prompt и Knowledge Base являются отдельными механизмами.
