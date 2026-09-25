import assert from "node:assert/strict";
import test from "node:test";

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("image generator maps supported aspect ratios to expected sizes", async () => {
  process.env.IMAGE_MODEL_API_KEY = "test-key";
  process.env.IMAGE_MODEL_BASE_URL = "https://example.com/v1";
  process.env.IMAGE_MODEL = "openai/gpt-image-2";
  process.env.LUNA_MODEL = "test-main-model";

  const { createHttpImageGenerator } = await import(
    "../src/modules/ai/generators/http.image.js"
  );

  const cases = [
    ["1:1", "1024x1024", 1024, 1024],
    ["4:5", "1024x1280", 1024, 1280],
    ["9:16", "1024x1536", 1024, 1536],
    ["16:9", "1536x1024", 1536, 1024],
  ] as const;

  for (const [aspectRatio, size, width, height] of cases) {
    globalThis.fetch = async (_input, init) => {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.tools[0].size, size);

      return new Response(
        JSON.stringify({
          output: [
            {
              type: "image_generation_call",
              status: "completed",
              result: "aGVsbG8=",
            },
          ],
        }),
        { status: 200 },
      );
    };

    const result = await createHttpImageGenerator().generate({
      profileId: "profile-1",
      prompt: "test",
      aspectRatio,
      references: [],
    });

    assert.equal(result.width, width);
    assert.equal(result.height, height);
  }
});
