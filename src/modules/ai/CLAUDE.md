# AI Module

The AI module contains LLM orchestration, content scenarios, references, search, memory/knowledge and media generators.

## Media E2E

'scripts/e2e-media-pipeline.ts' is the manual production-style E2E check for the media chain:

Image Responses API
→ base64 image
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

The check requires working image generation, Fal Kling, Object Storage with a public HTTPS base URL, Prisma access and ffmpeg/ffprobe in the runtime environment.

Image generation remains provider-agnostic behind ImageGenerator; video generation remains behind VideoGenerator; storage is handled by createStorageService; FFmpeg is handled by VideoComposer.
