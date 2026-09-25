import assert from "node:assert/strict";
import test from "node:test";

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("Timeweb image generator parses base64 image response", async () => {
  process.env.IMAGE_MODEL_API_KEY = "test-key";
  process.env.IMAGE_MODEL_BASE_URL = "https://example.com/v1";
  process.env.IMAGE_MODEL = "black_forest_labs/flux-2-pro";

  const { createHttpImageGenerator } = await import("../src/modules/ai/generators/http.image.js");

  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "https://example.com/v1/images/generations");
    assert.equal(init?.method, "POST");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, "black_forest_labs/flux-2-pro");
    assert.match(body.prompt, /A portrait/);
    assert.match(body.prompt, /9:16/);

    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 4, 0, 0, 0, 6, 0]);
    return new Response(JSON.stringify({ data: [{ b64_json: png.toString("base64") }] }), { status: 200, headers: { "content-type": "application/json" } });
  };

  const result = await createHttpImageGenerator().generate({ profileId: "profile-1", prompt: "A portrait", aspectRatio: "9:16", references: [] });
  assert.ok(result.contentBase64);
  assert.equal(result.width, 1024);
  assert.equal(result.height, 1536);
  assert.equal(result.mimeType, "image/png");
  assert.equal(result.provider, "timeweb");
  assert.equal(result.model, "black_forest_labs/flux-2-pro");
});

test("Timeweb image generator downloads URL response", async () => {
  process.env.IMAGE_MODEL_API_KEY = "test-key";
  process.env.IMAGE_MODEL_BASE_URL = "https://example.com/v1";
  process.env.IMAGE_MODEL = "black_forest_labs/flux-2-pro";

  const { createHttpImageGenerator } = await import("../src/modules/ai/generators/http.image.js");
  let requestCount = 0;

  globalThis.fetch = async (input, init) => {
    requestCount += 1;
    if (requestCount === 1) {
      assert.equal(String(input), "https://example.com/v1/images/generations");
      assert.equal(init?.method, "POST");
      return new Response(JSON.stringify({ data: [{ url: "https://cdn.example.com/generated.png" }] }), { status: 200, headers: { "content-type": "application/json" } });
    }

    assert.equal(String(input), "https://cdn.example.com/generated.png");
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 4, 0, 0, 0, 6, 0]);
    return new Response(png, { status: 200, headers: { "content-type": "image/png" } });
  };

  const result = await createHttpImageGenerator().generate({ profileId: "profile-1", prompt: "A portrait", aspectRatio: "9:16", references: [] });
  assert.equal(requestCount, 2);
  assert.equal(result.width, 1024);
  assert.equal(result.height, 1536);
  assert.equal(result.mimeType, "image/png");
  assert.ok(result.contentBase64);
});

test("Timeweb image generator rejects unsuccessful HTTP response", async () => {
  process.env.IMAGE_MODEL_API_KEY = "test-key";
  process.env.IMAGE_MODEL_BASE_URL = "https://example.com/v1";
  process.env.IMAGE_MODEL = "black_forest_labs/flux-2-pro";

  const { createHttpImageGenerator } = await import("../src/modules/ai/generators/http.image.js");
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: "invalid model" } }), { status: 400 });

  await assert.rejects(() => createHttpImageGenerator().generate({ profileId: "profile-1", prompt: "A portrait", aspectRatio: "1:1", references: [] }), /Image generator HTTP 400: invalid model/);
});

test("Timeweb image generator rejects missing image", async () => {
  process.env.IMAGE_MODEL_API_KEY = "test-key";
  process.env.IMAGE_MODEL_BASE_URL = "https://example.com/v1";
  process.env.IMAGE_MODEL = "black_forest_labs/flux-2-pro";

  const { createHttpImageGenerator } = await import("../src/modules/ai/generators/http.image.js");
  globalThis.fetch = async () => new Response(JSON.stringify({ data: [] }), { status: 200 });

  await assert.rejects(() => createHttpImageGenerator().generate({ profileId: "profile-1", prompt: "A portrait", references: [] }), /did not contain an image/);
});