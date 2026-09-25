# Media Generators

Папка отвечает за генерацию изображений, видео и композицию видео.

## Контракты

`types.ts` разделяет:

- `ImageGenerator` — генерация изображения.
- `VideoGenerator` — генерация видео.
- `CharacterReferenceInput` — reference images/character references.

Изображение и видео намеренно являются разными provider interfaces.

## Image

`image.provider.ts` выбирает реализацию.

- `openai.image.ts` — OpenAI Images API, текущая модель по умолчанию `gpt-image-2`.
- `http.image.ts` — generic HTTP adapter.

Результат может быть URL, Base64 или storage key. Pipeline приводит результат к Object Storage.

## Video

`video.provider.ts` выбирает реализацию.

- `fal.video.ts` — fal.ai Kling V3 Pro image-to-video.
- `http.video.ts` — generic HTTP adapter.

Текущий Reel flow передаёт сгенерированный frame как `startImageUrl`.

## Composition

`composer.ts` возвращает singleton composer.

`ffmpeg.composer.ts` скачивает сцены и объединяет их в MP4 с нормализацией размера/FPS.

Важно: текущий composer использует FFmpeg с `-an`, поэтому аудио отдельных Kling clips отбрасывается. Это сознательная текущая реализация, а не гарантия сохранения audio.

## Правила

1. Provider-specific код не должен попадать в pipeline.
2. Не привязывать бизнес-логику к одному генератору.
3. URL, передаваемый внешнему video provider, должен быть реально доступен provider.
4. Не использовать удалённый OpenAI Sora API: Videos API/Sora были deprecated/shut down.
5. При добавлении provider обновить env schema, provider selector и README.
