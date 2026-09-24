import type { MediaReferenceType } from "../../../generated/prisma/enums";

/** Structured metadata stored on MediaReference.metadata */
export type ReferenceMetadata = {
  /** Human description — critical for consistency ("blonde, blue eyes, freckles…") */
  description: string;
  tags?: string[];
  /** Higher = preferred in generation pack (default 1) */
  priority?: number;
  notes?: string;
  /** Optional: which features this ref locks */
  locks?: Array<
    | "face"
    | "hair"
    | "body"
    | "outfit"
    | "style"
    | "location"
    | "lighting"
  >;
};

export type CreateReferenceInput = {
  profileId: string;
  type: MediaReferenceType | string;
  /** Public or storage URL of the reference photo */
  url: string;
  description: string;
  tags?: string[];
  priority?: number;
  notes?: string;
  locks?: ReferenceMetadata["locks"];
  mimeType?: string;
};

export type ReferencePackItem = {
  id: string;
  type: string;
  url: string;
  description: string;
  priority: number;
  tags: string[];
};
