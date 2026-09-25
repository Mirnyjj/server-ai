import assert from "node:assert/strict";
import test from "node:test";

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

function configureVideoEnv() {
  process.env.VIDEO_GENERATOR_BASE_URL = "https://example.com/video";
  process.env.VIDEO_GENERATOR_API_KEY = "test-key";
  process.env.VIDEO_GENERATOR_MODEL = "test-video-model";
}

test("HTTP video generator sends generation request and parses url", async () => {
  configureVideoEnv();

  const { createHttpVideoGenerator } = await import(
    "../src/modules/ai/generators/http.video.js"
  );

  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "https://example.com/video");
    assert.equal(init?.method, "POST");
    assert.equal(
      init?.headers instanceof Headers
        ? init.headers.get("authorization")
        : (init?.headers as Record<string, string>)?.Authorization,
      "Bearer test-key",
    );

    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, "test-video-model");
    assert.equal(body.duration, 6);
    assert.equal(body.aspect_ratio, "9:16");
    assert.equal(body.image_url, "https://cdn.example.com/start.png");
    assert.match(body.prompt, /A cinematic portrait/);
    assert.match(body.prompt, /\[FACE\] Keep the same character/);

    return new Response(
      JSON.stringify({ url: "https://cdn.example.com/video.mp4" }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const result = await createHttpVideoGenerator().generate({
    profileId: "profile-1",
    prompt: "A cinematic portrait",
    startImageUrl: "https://cdn.example.com/start.png",
    durationSec: 6,
    aspectRatio: "9:16",
    references: [
      {
        type: "FACE",
        url: "https://cdn.example.com/face.png",
        description: "Keep the same character",
      },
      {
        type: "STYLE",
        url: "https://cdn.example.com/style.png",
        description: "Use this lighting",
      },
    ],
  });

  assert.equal(result.url, "https://cdn.example.com/video.mp4");
  assert.equal(result.provider, "http");
  assert.equal(result.model, "test-video-model");
  assert.equal(result.mimeType, "video/mp4");
  assert.equal(result.durationMs, 6000);
});

test("HTTP video generator supports all documented response URL shapes", async () => {
  configureVideoEnv();

  const { createHttpVideoGenerator } = await import(
    "../src/modules/ai/generators/http.video.js"
  );

  const responses = [
    { url: "https://cdn.example.com/one.mp4" },
    { video_url: "https://cdn.example.com/two.mp4" },
    { data: [{ url: "https://cdn.example.com/three.mp4" }] },
    { output: ["https://cdn.example.com/four.mp4"] },
  ];

  for (const payload of responses) {
    globalThis.fetch = async () =>
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      });

    const result = await createHttpVideoGenerator().generate({
      profileId: "profile-1",
      prompt: "test",
      references: [],
    });

    assert.match(result.url, /^https:\/\/cdn\.example\.com\/\w+\.mp4$/);
  }
});

test("HTTP video generator rejects unsuccessful response", async () => {
  configureVideoEnv();

  const { createHttpVideoGenerator } = await import(
    "../src/modules/ai/generators/http.video.js"
  );

  globalThis.fetch = async () =>
    new Response("provider failed", { status: 502 });

  await assert.rejects(
    () =>
      createHttpVideoGenerator().generate({
        profileId: "profile-1",
        prompt: "test",
        references: [],
      }),
    /Video generator HTTP 502: provider failed/,
  );
});

test("HTTP video generator rejects response without a video URL", async () => {
  configureVideoEnv();

  const { createHttpVideoGenerator } = await import(
    "../src/modules/ai/generators/http.video.js"
  );

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  await assert.rejects(
    () =>
      createHttpVideoGenerator().generate({
        profileId: "profile-1",
        prompt: "test",
        references: [],
      }),
    /Video generator response missing url/,
  );
});
