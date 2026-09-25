import assert from "node:assert/strict";
import test from "node:test";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { probeMedia, transcodeToMp4 } from "../src/infrastructure/media/ffmpeg.js";

const execFileAsync = promisify(execFile);

test("FFmpeg transcode keeps video and audio streams", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ig-agent-ffmpeg-test-"));
  const sourcePath = join(directory, "source.mp4");

  try {
    await execFileAsync("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=black:s=320x568:d=1",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=1",
      "-shortest",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      sourcePath,
    ]);

    const source = await readFile(sourcePath);
    const sourceProbe = await probeMedia(source);

    assert.equal(sourceProbe.hasVideo, true);
    assert.equal(sourceProbe.hasAudio, true);

    const output = await transcodeToMp4(source);
    const outputProbe = await probeMedia(output);

    assert.equal(outputProbe.hasVideo, true);
    assert.equal(outputProbe.hasAudio, true);
    assert.equal(outputProbe.width, 320);
    assert.equal(outputProbe.height, 568);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
