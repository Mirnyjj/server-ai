import assert from "node:assert/strict";
import test from "node:test";

import { buildS3PublicUrl } from "../src/infrastructure/storage/public-url.js";

const bucket = "4ba2581a-8c9f-497a-a279-4caebb77fba0";
const key = "profiles/profile-1/generated/image.png";

test("Timeweb endpoint used as public base includes bucket", () => {
  assert.equal(
    buildS3PublicUrl({
      key,
      bucket,
      endpoint: "https://s3.twcstorage.ru",
      publicBase: "https://s3.twcstorage.ru",
      region: "auto",
    }),
    `https://s3.twcstorage.ru/${bucket}/${key}`,
  );
});

test("S3 endpoint without public base uses path-style bucket URL", () => {
  assert.equal(
    buildS3PublicUrl({
      key,
      bucket,
      endpoint: "https://s3.twcstorage.ru/",
      region: "auto",
    }),
    `https://s3.twcstorage.ru/${bucket}/${key}`,
  );
});

test("Custom public base does not receive the bucket automatically", () => {
  assert.equal(
    buildS3PublicUrl({
      key,
      bucket,
      endpoint: "https://s3.twcstorage.ru",
      publicBase: "https://cdn.example.com/media",
      region: "auto",
    }),
    `https://cdn.example.com/media/${key}`,
  );
});

test("AWS fallback uses virtual-hosted style", () => {
  assert.equal(
    buildS3PublicUrl({
      key,
      bucket,
      region: "eu-central-1",
    }),
    `https://${bucket}.s3.eu-central-1.amazonaws.com/${key}`,
  );
});

test("Leading slash in object key is normalized", () => {
  assert.equal(
    buildS3PublicUrl({
      key: `//${key}`,
      bucket,
      endpoint: "https://s3.twcstorage.ru",
      region: "auto",
    }),
    `https://s3.twcstorage.ru/${bucket}/${key}`,
  );
});


test("Supabase Storage uses its public object URL as an explicit public base", () => {
  assert.equal(
    buildS3PublicUrl({
      key,
      bucket: "media",
      endpoint: "https://project-ref.storage.supabase.co/storage/v1/s3",
      publicBase:
        "https://project-ref.supabase.co/storage/v1/object/public/media",
      region: "eu-central-1",
    }),
    `https://project-ref.supabase.co/storage/v1/object/public/media/${key}`,
  );
});
