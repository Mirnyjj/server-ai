# Media References

Этот слой управляет reference assets, используемыми AI при генерации.

- `reference.types.ts` — типы references.
- `reference.service.ts` — CRUD и выбор references.
- `reference.routes.ts` — HTTP transport.

References позволяют передавать генератору информацию о персонаже, визуальной идентичности и других постоянных визуальных элементах.

Генератор получает references через provider-neutral `CharacterReferenceInput`. Поэтому service не должен знать API конкретного OpenAI/fal provider.

Все references должны быть связаны с profile. При выборе references учитывать priority и назначение asset.
