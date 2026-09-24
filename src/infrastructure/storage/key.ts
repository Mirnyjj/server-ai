import { randomUUID } from "node:crypto";

/** Build stable storage keys for media */
export function buildMediaKey(input: {
  profileId: string;
  kind: "generated" | "reference" | "upload" | "temp";
  ext: string;
  postId?: string;
}): string {
  const ext = input.ext.replace(/^\./, "").toLowerCase();
  const id = randomUUID();
  const base = `profiles/${input.profileId}/${input.kind}`;
  if (input.postId) {
    return `${base}/${input.postId}/${id}.${ext}`;
  }
  return `${base}/${id}.${ext}`;
}

export function extensionFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
  };
  return map[mime] ?? "bin";
}

export function guessMimeFromUrl(url: string): string | undefined {
  const path = url.split("?")[0].toLowerCase();
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".gif")) return "image/gif";
  if (path.endsWith(".mp4")) return "video/mp4";
  if (path.endsWith(".mov")) return "video/quicktime";
  if (path.endsWith(".webm")) return "video/webm";
  return undefined;
}
