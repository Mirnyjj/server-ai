# Object Storage (ТЗ §13–14)

Meta Graph API требует **публично доступный HTTPS URL** для `image_url` / `video_url`.
Binary upload напрямую в Graph — не используем.

## Providers

| STORAGE_PROVIDER | Backend |
|------------------|--------|
| `local` (default) | `./storage-data` + `GET /media/*` |
| `s3` / `r2` / `minio` | AWS SDK S3-compatible |

## Env

```env
# --- Local dev ---
STORAGE_PROVIDER=local
STORAGE_LOCAL_PATH=./storage-data
STORAGE_PUBLIC_BASE_URL=https://xxxx.ngrok.io/media   # tunnel required for Meta

# --- Cloudflare R2 ---
STORAGE_PROVIDER=r2
STORAGE_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
STORAGE_REGION=auto
STORAGE_BUCKET=ig-media
STORAGE_ACCESS_KEY_ID=
STORAGE_SECRET_ACCESS_KEY=
STORAGE_PUBLIC_BASE_URL=https://cdn.example.com      # R2 public / custom domain
STORAGE_FORCE_PATH_STYLE=false

# --- AWS S3 ---
STORAGE_PROVIDER=s3
STORAGE_REGION=eu-central-1
STORAGE_BUCKET=ig-media
STORAGE_ACCESS_KEY_ID=
STORAGE_SECRET_ACCESS_KEY=
STORAGE_PUBLIC_BASE_URL=https://ig-media.s3.eu-central-1.amazonaws.com
# or CloudFront URL
```

## API

| Method | Path |
|--------|------|
| GET | `/api/storage/status` |
| POST | `/api/storage/ingest` `{ profileId, sourceUrl, mediaType? }` |
| GET | `/media/*` local files |

## Code

```ts
import { getObjectStorage, buildMediaKey } from "./infrastructure/storage";
import { createStorageService } from "./infrastructure/storage/storage.service";

const { asset } = await createStorageService().ingestUrl({
  profileId, sourceUrl, mediaType: "IMAGE", kind: "generated",
});
// asset.url → public HTTPS for Meta
```

Pipeline calls `ingestUrl` after generators so Post media always points at our storage.
