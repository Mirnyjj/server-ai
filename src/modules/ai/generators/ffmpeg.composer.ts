import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  VideoCompositionRequest,
  VideoComposer,
} from "./composer.types.js";

export function createFfmpegVideoComposer(): VideoComposer {
  return {
    name: "ffmpeg",

    async compose(request: VideoCompositionRequest) {
      if (request.scenes.length === 0) {
        throw new Error("Video composer requires at least one scene");
      }

      const directory = await mkdtemp(join(tmpdir(), "ig-agent-video-"));

      try {
        const inputFiles: string[] = [];

        for (let index = 0; index < request.scenes.length; index += 1) {
          const scene = request.scenes[index];
          if (!scene) continue;

          const response = await fetch(scene.url);
          if (!response.ok) {
            throw new Error("Failed to download video scene (" + response.status + ")");
          }

          const file = join(directory, "scene-" + index + ".mp4");
          await writeFile(file, Buffer.from(await response.arrayBuffer()));
          inputFiles.push(file);
        }

        const listFile = join(directory, "concat.txt");
        await writeFile(
          listFile,
          inputFiles.map((file) => "file '" + file.replaceAll("'", "'\\''") + "'").join("\n"),
        );

        const output = join(directory, "output.mp4");

        await runFfmpeg([
          "-f", "concat",
          "-safe", "0",
          "-i", listFile,
          "-vf", "scale=" + request.width + ":" + request.height + ":force_original_aspect_ratio=decrease,pad=" + request.width + ":" + request.height + ":(ow-iw)/2:(oh-ih)/2,format=yuv420p",
          "-r", String(request.fps ?? 30),
          "-c:v", "libx264",
          "-preset", "veryfast",
          "-crf", "20",
          "-movflags", "+faststart",
          "-c:a", "aac",
          "-b:a", "128k",
          "-y", output,
        ]);

        const body = await readFile(output);
        const durationMs = await probeDurationMs(output);

        return {
          contentBase64: body.toString("base64"),
          mimeType: "video/mp4" as const,
          durationMs,
          width: request.width,
          height: request.height,
        };
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    },
  };
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const process = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    process.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    process.on("error", reject);
    process.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error("ffmpeg failed (" + code + "): " + stderr.slice(-4000)));
    });
  });
}

function probeDurationMs(file: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const process = spawn("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      file,
    ], { stdio: ["ignore", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";
    process.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    process.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    process.on("error", reject);
    process.on("close", (code) => {
      if (code !== 0) reject(new Error("ffprobe failed (" + code + "): " + stderr.slice(-1000)));
      else resolve(Math.round(Number.parseFloat(stdout.trim()) * 1000));
    });
  });
}
