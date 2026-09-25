# Audio Transcription

`transcription.service.ts` — клиент локального Whisper HTTP service.

Production architecture:

Telegram voice/audio -> Telegram API download -> Whisper container -> transcript -> Telegram AI.

Whisper работает отдельно в Docker Compose на internal URL `http://whisper:8001`.

Не переносить модель Whisper внутрь Node API: это отдельный CPU/memory-heavy service.

Ошибки transcription должны возвращаться вызывающему layer как обычная ошибка и не оставлять Telegram request в неопределённом состоянии.
