import type { ImageGenerator } from "./types.js";
import { createHttpImageGenerator } from "./http.image.js";

export function createImageGenerator(): ImageGenerator {
  return createHttpImageGenerator();
}

let singleton: ImageGenerator | null = null;

export function getImageGenerator(): ImageGenerator {
  if (!singleton) singleton = createImageGenerator();
  return singleton;
}
