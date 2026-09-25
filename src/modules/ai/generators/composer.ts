import type { VideoComposer } from "./composer.types.js";
import { createFfmpegVideoComposer } from "./ffmpeg.composer.js";

let singleton: VideoComposer | null = null;

export function getVideoComposer(): VideoComposer {
  if (!singleton) singleton = createFfmpegVideoComposer();
  return singleton;
}
