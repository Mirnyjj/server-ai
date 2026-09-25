import { prisma } from "../../../prisma/prisma.js";

export type KnowledgeSourceType =
  | "MANUAL"
  | "FILE"
  | "URL"
  | "INSTAGRAM"
  | "TELEGRAM"
  | "OTHER";

export type KnowledgeSearchResult = {
  id: string;
  documentId: string;
  title: string;
  source: string | null;
  sourceType: KnowledgeSourceType;
  content: string;
  score: number;
};

const CHUNK_SIZE = 1800;
const CHUNK_OVERLAP = 200;

export async function addKnowledgeDocument(input: {
  profileId: string;
  title: string;
  content: string;
  source?: string;
  sourceType?: KnowledgeSourceType;
  metadata?: Record<string, unknown>;
}): Promise<{ id: string; chunks: number }> {
  const content = input.content.trim();

  if (!content) {
    throw new Error("Содержимое документа не может быть пустым");
  }

  const chunks = splitIntoChunks(content);

  const document = await prisma.$transaction(async (tx) => {
    const created = await tx.knowledgeDocument.create({
      data: {
        profileId: input.profileId,
        title: input.title.trim(),
        content,
        source: input.source?.trim() || null,
        sourceType: input.sourceType ?? "MANUAL",
        metadata: input.metadata,
      },
    });

    await tx.knowledgeChunk.createMany({
      data: chunks.map((chunk, index) => ({
        documentId: created.id,
        profileId: input.profileId,
        chunkIndex: index,
        content: chunk,
      })),
    });

    return created;
  });

  return {
    id: document.id,
    chunks: chunks.length,
  };
}

export async function listKnowledgeDocuments(
  profileId: string,
  take = 20,
) {
  return prisma.knowledgeDocument.findMany({
    where: { profileId },
    orderBy: { updatedAt: "desc" },
    take: Math.min(take, 100),
    select: {
      id: true,
      title: true,
      source: true,
      sourceType: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function deleteKnowledgeDocument(
  profileId: string,
  documentId: string,
): Promise<void> {
  const document = await prisma.knowledgeDocument.findFirst({
    where: { id: documentId, profileId },
    select: { id: true },
  });

  if (!document) {
    throw new Error("Документ базы знаний не найден");
  }

  await prisma.knowledgeDocument.delete({
    where: { id: document.id },
  });
}

export async function searchKnowledge(
  profileId: string,
  query: string,
  take = 8,
): Promise<KnowledgeSearchResult[]> {
  const terms = tokenize(query);

  if (terms.length === 0) return [];

  const chunks = await prisma.knowledgeChunk.findMany({
    where: {
      profileId,
      OR: terms.map((term) => ({
        content: {
          contains: term,
          mode: "insensitive",
        },
      })),
    },
    include: {
      document: {
        select: {
          title: true,
          source: true,
          sourceType: true,
        },
      },
    },
    take: 200,
  });

  return chunks
    .map((chunk) => {
      const lower = chunk.content.toLocaleLowerCase();
      const score = terms.reduce(
        (total, term) =>
          total + (lower.includes(term.toLocaleLowerCase()) ? 1 : 0),
        0,
      );

      return {
        id: chunk.id,
        documentId: chunk.documentId,
        title: chunk.document.title,
        source: chunk.document.source,
        sourceType: chunk.document.sourceType,
        content: chunk.content,
        score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(take, 20));
}

export function splitIntoChunks(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  const chunks: string[] = [];

  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + CHUNK_SIZE, normalized.length);

    if (end < normalized.length) {
      const paragraphBreak = normalized.lastIndexOf("\n\n", end);
      const sentenceBreak = normalized.lastIndexOf(". ", end);

      if (paragraphBreak > start + CHUNK_SIZE * 0.6) {
        end = paragraphBreak;
      } else if (sentenceBreak > start + CHUNK_SIZE * 0.6) {
        end = sentenceBreak + 1;
      }
    }

    const chunk = normalized.slice(start, end).trim();

    if (chunk) chunks.push(chunk);

    if (end >= normalized.length) break;

    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }

  return chunks;
}

function tokenize(query: string): string[] {
  return [...new Set(
    query
      .toLocaleLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .map((term) => term.trim())
      .filter((term) => term.length >= 3),
  )].slice(0, 12);
}
