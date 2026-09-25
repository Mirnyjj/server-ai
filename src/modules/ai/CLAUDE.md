# AI Module

The AI module contains LLM orchestration, content scenarios, references, search, memory/knowledge and media generators.

## Media E2E

'scripts/e2e-media-pipeline.ts' is the manual production-style E2E check for the media chain:

Timeweb Images API
→ image response (URL or base64)
→ normalized base64 image
→ Object Storage
→ public HTTPS verification
→ Fal Kling image-to-video
→ Object Storage
→ public HTTPS verification
→ FFmpeg
→ MP4 with video + audio streams
→ Object Storage
→ public HTTPS verification

Run it with a real configured environment and an existing profile:

    E2E_PROFILE_ID=<active-ai-profile-id> npm run e2e:media

The check creates temporary MediaAsset rows and storage objects and removes them in finally. It does not create a Post.

The check requires working Timeweb image generation, Fal Kling, Object Storage with a public HTTPS base URL, Prisma access and ffmpeg/ffprobe in the runtime environment.

## Image generation

The image generator uses the provider-agnostic ImageGenerator interface with a Timeweb AI Gateway HTTP adapter.

Required environment:

    IMAGE_MODEL_API_KEY=<Timeweb AI Gateway key>
    IMAGE_MODEL_BASE_URL=https://api.timeweb.ai/v1
    IMAGE_MODEL=black_forest_labs/flux-2-pro

The adapter calls POST /images/generations and normalizes either data[0].b64_json or data[0].url into contentBase64. URL responses are downloaded before returning so the storage pipeline does not depend on an expiring provider URL.

The request uses the documented model and prompt fields. The requested aspect ratio is included in the prompt because this adapter relies only on the documented request fields.

The adapter detects PNG, JPEG, GIF and WebP dimensions when available; otherwise it falls back to the requested aspect-ratio dimensions.

Image generation remains behind ImageGenerator; the content pipeline does not contain provider-specific routing.
