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


## External downloads

S3/R2 `putFromUrl` downloads generator output with a 120-second AbortSignal timeout. The timeout is always cleared in a `finally` block, including failed or aborted requests.


## Public URL resolution

For S3-compatible storage, `STORAGE_PUBLIC_BASE_URL` is treated as an object public base such as a CDN/custom domain. If it is exactly the same normalized URL as `STORAGE_ENDPOINT`, it is interpreted as the S3 API endpoint rather than an object root, and the bucket is inserted into the path.

For Timeweb Cloud S3, this means the following configuration is supported:

```env
STORAGE_ENDPOINT=https://s3.twcstorage.ru
STORAGE_PUBLIC_BASE_URL=https://s3.twcstorage.ru
STORAGE_BUCKET=<bucket-id>
```

An object key such as `profiles/<profileId>/generated/<id>.png` resolves to:

```
https://s3.twcstorage.ru/<bucket-id>/profiles/<profileId>/generated/<id>.png
```

A different `STORAGE_PUBLIC_BASE_URL` is treated as an explicit public/CDN base and does not receive the bucket automatically.
