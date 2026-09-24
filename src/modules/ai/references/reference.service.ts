import { prisma } from "../../../../prisma/prisma";
import type { MediaReferenceType } from "../../../generated/prisma/enums";
import type {
  CreateReferenceInput,
  ReferenceMetadata,
  ReferencePackItem,
} from "./reference.types";

const VALID_TYPES = new Set([
  "FACE",
  "FULL_BODY",
  "STYLE",
  "OUTFIT",
  "LOCATION",
  "LIGHTING",
  "REFERENCE",
]);

export function createReferenceService() {
  /**
   * Register a character reference photo + description.
   * Creates MediaAsset + MediaReference linked to profile.
   */
  async function addReference(input: CreateReferenceInput) {
    const type = input.type.toUpperCase();
    if (!VALID_TYPES.has(type)) {
      throw new Error(
        `Invalid type "${input.type}". Use: ${[...VALID_TYPES].join(", ")}`,
      );
    }

    if (!input.description?.trim()) {
      throw new Error("description is required for character consistency");
    }

    if (!input.url?.trim()) {
      throw new Error("url is required");
    }

    const profile = await prisma.aiProfile.findUnique({
      where: { id: input.profileId },
    });
    if (!profile) {
      throw new Error(`Profile ${input.profileId} not found`);
    }

    const metadata: ReferenceMetadata = {
      description: input.description.trim(),
      tags: input.tags ?? [],
      priority: input.priority ?? 1,
      notes: input.notes,
      locks: input.locks,
    };

    const asset = await prisma.mediaAsset.create({
      data: {
        profileId: input.profileId,
        type: "IMAGE",
        status: "ACTIVE",
        url: input.url,
        mimeType: input.mimeType ?? "image/jpeg",
        metadata: {
          role: "character_reference",
          referenceType: type,
        },
      },
    });

    const reference = await prisma.mediaReference.create({
      data: {
        profileId: input.profileId,
        type: type as MediaReferenceType,
        mediaAssetId: asset.id,
        metadata: metadata as object,
      },
      include: { mediaAsset: true },
    });

    return reference;
  }

  async function listReferences(profileId: string) {
    return prisma.mediaReference.findMany({
      where: { profileId },
      include: { mediaAsset: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async function deleteReference(id: string) {
    const ref = await prisma.mediaReference.findUnique({ where: { id } });
    if (!ref) throw new Error(`Reference ${id} not found`);

    await prisma.mediaReference.delete({ where: { id } });
    // Keep MediaAsset for history; mark deleted if only used as ref
    if (ref.mediaAssetId) {
      await prisma.mediaAsset.update({
        where: { id: ref.mediaAssetId },
        data: { status: "DELETED" },
      });
    }
    return { deleted: true, id };
  }

  /**
   * Pack for generators + Luna briefs.
   * Sorted by priority desc; FACE/FULL_BODY first among same priority.
   */
  async function getReferencePack(
    profileId: string,
    options?: { limit?: number },
  ): Promise<ReferencePackItem[]> {
    const limit = options?.limit ?? 12;
    const refs = await prisma.mediaReference.findMany({
      where: { profileId },
      include: { mediaAsset: true },
    });

    const typeOrder: Record<string, number> = {
      FACE: 0,
      FULL_BODY: 1,
      STYLE: 2,
      OUTFIT: 3,
      LIGHTING: 4,
      LOCATION: 5,
      REFERENCE: 6,
    };

    const items: ReferencePackItem[] = refs
      .filter((r) => r.mediaAsset?.url && r.mediaAsset.status !== "DELETED")
      .map((r) => {
        const meta = (r.metadata ?? {}) as Partial<ReferenceMetadata>;
        return {
          id: r.id,
          type: r.type,
          url: r.mediaAsset!.url,
          description: meta.description ?? "",
          priority: meta.priority ?? 1,
          tags: meta.tags ?? [],
        };
      })
      .sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9);
      })
      .slice(0, limit);

    return items;
  }

  /**
   * Text block injected into Luna / image prompts for consistency.
   */
  async function buildConsistencyPrompt(profileId: string): Promise<string> {
    const pack = await getReferencePack(profileId);
    if (pack.length === 0) {
      return "No character references registered. Visual identity may drift.";
    }

    const lines = pack.map(
      (r, i) =>
        `${i + 1}. [${r.type}] ${r.description || "(no description)"} (priority ${r.priority})`,
    );

    return [
      "CHARACTER CONSISTENCY REFERENCES (must match across all generations):",
      ...lines,
      "Do not change face structure, hair color, age, or body type unless explicitly asked.",
    ].join("\n");
  }

  return {
    addReference,
    listReferences,
    deleteReference,
    getReferencePack,
    buildConsistencyPrompt,
  };
}
