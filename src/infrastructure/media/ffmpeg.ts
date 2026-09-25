import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

type CommandResult = {
  stdout: string;
  stderr: string;
};

async function runCommand(
  command: string,
  args: string[],
  timeoutMs = 120_000,
): Promise<CommandResult> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (error?: Error, result?: CommandResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve(result!);
    };

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.once("error", (error) => finish(error));

    child.once("close", (code, signal) => {
      if (code === 0) {
        finish(undefined, { stdout, stderr });
        return;
      }

      finish(
        new Error(
          `${command} exited with code=${code ?? "null"} signal=${signal ?? "null"}: ${stderr.slice(-4000)}`,
        ),
      );
    });

    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      finish(new Error(`${command} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
}

export async function transcodeToMp4(
  input: Buffer,
  options: {
    timeoutMs?: number;
    videoCodec?: "libx264";
    crf?: number;
  } = {},
): Promise<Buffer> {
  const directory = await mkdtemp(join(tmpdir(), "ig-agent-ffmpeg-"));
  const inputPath = join(directory, "input");
  const outputPath = join(directory, "output.mp4");

  try {
    await writeFile(inputPath, input);

    await runCommand(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        inputPath,
        "-map",
        "0:v:0",
        "-map",
        "0:a?",
        "-c:v",
        options.videoCodec ?? "libx264",
        "-preset",
        "veryfast",
        "-crf",
        String(options.crf ?? 20),
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-movflags",
        "+faststart",
        outputPath,
      ],
      options.timeoutMs,
    );

    return await readFile(outputPath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export type MediaProbe = {
  durationSec?: number;
  width?: number;
  height?: number;
  hasVideo: boolean;
  hasAudio: boolean;
};

export async function probeMedia(
  input: Buffer,
  timeoutMs = 30_000,
): Promise<MediaProbe> {
  const directory = await mkdtemp(join(tmpdir(), "ig-agent-ffprobe-"));
  const inputPath = join(directory, "input");

  try {
    await writeFile(inputPath, input);

    const result = await runCommand(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_streams",
        "-show_format",
        "-of",
        "json",
        inputPath,
      ],
      timeoutMs,
    );

    const json = JSON.parse(result.stdout) as {
      streams?: Array<{
        codec_type?: string;
        width?: number;
        height?: number;
      }>;
      format?: {
        duration?: string;
      };
    };

    const video = json.streams?.find((stream) => stream.codec_type === "video");
    const audio = json.streams?.some((stream) => stream.codec_type === "audio") ?? false;

    return {
      durationSec:
        json.format?.duration && Number.isFinite(Number(json.format.duration))
          ? Number(json.format.duration)
          : undefined,
      width: video?.width,
      height: video?.height,
      hasVideo: Boolean(video),
      hasAudio: audio,
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
