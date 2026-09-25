import assert from "node:assert/strict";
import test from "node:test";

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("Responses image generator parses completed image_generation_call", async () => {
  process.env.IMAGE_MODEL_API_KEY = "test-key";
  process.env.IMAGE_MODEL_BASE_URL = "https://example.com/v1";
  process.env.IMAGE_MODEL = "openai/gpt-image-2";
  process.env.LUNA_MODEL = "test-main-model";

  const { createHttpImageGenerator } = await import(
    "../src/modules/ai/generators/http.image.js"
  );

  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "https://example.com/v1/responses");
    assert.equal(init?.method, "POST");

    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, "test-main-model");
    assert.equal(body.tools[0].type, "image_generation");
    assert.equal(body.tools[0].model, "openai/gpt-image-2");
    assert.equal(body.tools[0].size, "1024x1536");

    return new Response(
      JSON.stringify({
        id: "resp_test",
        output: [
          {
            type: "image_generation_call",
            status: "completed",
            result: "aGVsbG8=",
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const result = await createHttpImageGenerator().generate({
    profileId: "profile-1",
    prompt: "A portrait",
    aspectRatio: "9:16",
    references: [],
  });

  assert.equal(result.contentBase64, "aGVsbG8=");
  assert.equal(result.width, 1024);
  assert.equal(result.height, 1536);
  assert.equal(result.mimeType, "image/png");
});

test("Responses image generator rejects unsuccessful HTTP response", async () => {
  process.env.IMAGE_MODEL_API_KEY = "test-key";
  process.env.IMAGE_MODEL_BASE_URL = "https://example.com/v1";
  process.env.IMAGE_MODEL = "openai/gpt-image-2";
  process.env.LUNA_MODEL = "test-main-model";

  const { createHttpImageGenerator } = await import(
    "../src/modules/ai/generators/http.image.js"
  );

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        error: { message: "invalid model" },
      }),
      { status: 400 },
    );

  await assert.rejects(
    () =>
      createHttpImageGenerator().generate({
        profileId: "profile-1",
        prompt: "A portrait",
        aspectRatio: "1:1",
        references: [],
      }),
    /Image generator HTTP 400: invalid model/,
  );
});

test("Responses image generator rejects missing completed image", async () => {
  process.env.IMAGE_MODEL_API_KEY = "test-key";
  process.env.IMAGE_MODEL_BASE_URL = "https://example.com/v1";
  process.env.IMAGE_MODEL = "openai/gpt-image-2";
  process.env.LUNA_MODEL = "test-main-model";

  const { createHttpImageGenerator } = await import(
    "../src/modules/ai/generators/http.image.js"
  );

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        output: [
          {
            type: "image_generation_call",
            status: "in_progress",
          },
        ],
      }),
      { status: 200 },
    );

  await assert.rejects(
    () =>
      createHttpImageGenerator().generate({
        profileId: "profile-1",
        prompt: "A portrait",
        references: [],
      }),
    /did not contain a completed image_generation_call/,
  );
});
