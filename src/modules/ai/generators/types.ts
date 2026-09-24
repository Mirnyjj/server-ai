/**
 * Separate generation models (NOT Luna).
 * Image → posts / stories / carousel items
 * Video → reels / video posts
 */

export type CharacterReferenceInput = {
  type: string;
  url: string;
  description: string;
  priority?: number;
};

export type ImageGenerationRequest = {
  profileId: string;
  /** From Luna visual brief */
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: "1:1" | "4:5" | "9:16" | "16:9";
  width?: number;
  height?: number;
  /** Character consistency pack */
  references: CharacterReferenceInput[];
  /** visualIdentity JSON from AiProfile */
  visualIdentity?: unknown;
  seed?: number;
};

export type ImageGenerationResult = {
  url: string;
  storageKey?: string;
  width?: number;
  height?: number;
  mimeType?: string;
  provider: string;
  model: string;
  raw?: unknown;
};

export type VideoGenerationRequest = {
  profileId: string;
  prompt: string;
  /** Optional start frame from image generator */
  startImageUrl?: string;
  durationSec?: number;
  aspectRatio?: "9:16" | "16:9" | "1:1";
  references: CharacterReferenceInput[];
  visualIdentity?: unknown;
};

export type VideoGenerationResult = {
  url: string;
  storageKey?: string;
  durationMs?: number;
  width?: number;
  height?: number;
  mimeType?: string;
  provider: string;
  model: string;
  raw?: unknown;
};

export interface ImageGenerator {
  readonly name: string;
  generate(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
}

export interface VideoGenerator {
  readonly name: string;
  generate(request: VideoGenerationRequest): Promise<VideoGenerationResult>;
}
