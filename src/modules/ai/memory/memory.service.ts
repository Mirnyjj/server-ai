import { prisma } from "../../../prisma/prisma.js";

export type MemoryType =
  | "PERSONA"
  | "AUDIENCE"
  | "CONTENT"
  | "COMMENT"
  | "DM"
  | "PERFORMANCE"
  | "STRATEGY"
  | "PREFERENCE";

export type AgentMemoryRecord = {
  id: string;
  type: MemoryType;
  content: Record<string, unknown>;
  importance: number;
  createdAt: Date;
  expiresAt: Date | null;
};

export async function addAgentMemory(input: {
  profileId: string;
  type: MemoryType;
  text: string;
  importance?: number;
  expiresAt?: Date | null;
}): Promise<AgentMemoryRecord> {
  const text = input.text.trim();

  if (!text) {
    throw new Error("Текст памяти не может быть пустым");
  }

  const memory = await prisma.agentMemory.create({
    data: {
      profileId: input.profileId,
      type: input.type,
      content: { text },
      importance: Math.min(1, Math.max(0, input.importance ?? 0.7)),
      expiresAt: input.expiresAt ?? null,
    },
  });

  return memory as AgentMemoryRecord;
}

export async function listAgentMemories(
  profileId: string,
  options?: { type?: MemoryType; take?: number },
): Promise<AgentMemoryRecord[]> {
  const memories = await prisma.agentMemory.findMany({
    where: {
      profileId,
      ...(options?.type ? { type: options.type } : {}),
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
    take: Math.min(options?.take ?? 30, 100),
  });

  return memories as AgentMemoryRecord[];
}

export async function searchAgentMemories(
  profileId: string,
  query: string,
  take = 10,
): Promise<AgentMemoryRecord[]> {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  const memories = await listAgentMemories(profileId, { take: 100 });

  return memories
    .filter((memory) => {
      const text = getMemoryText(memory.content).toLocaleLowerCase();
      return text.includes(normalizedQuery);
    })
    .slice(0, Math.min(take, 50));
}

export async function deleteAgentMemory(
  profileId: string,
  memoryId: string,
): Promise<void> {
  const memory = await prisma.agentMemory.findFirst({
    where: {
      id: memoryId,
      profileId,
    },
    select: { id: true },
  });

  if (!memory) {
    throw new Error("Память не найдена");
  }

  await prisma.agentMemory.delete({
    where: { id: memory.id },
  });
}

export function getMemoryText(content: unknown): string {
  if (
    typeof content === "object" &&
    content !== null &&
    !Array.isArray(content) &&
    "text" in content &&
    typeof content.text === "string"
  ) {
    return content.text;
  }

  return JSON.stringify(content);
}
