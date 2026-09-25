CREATE TYPE "KnowledgeSourceType" AS ENUM ('MANUAL', 'FILE', 'URL', 'INSTAGRAM', 'TELEGRAM', 'OTHER');

CREATE TABLE "KnowledgeDocument" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT,
    "sourceType" "KnowledgeSourceType" NOT NULL DEFAULT 'MANUAL',
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KnowledgeChunk_documentId_chunkIndex_key"
ON "KnowledgeChunk"("documentId", "chunkIndex");

CREATE INDEX "KnowledgeDocument_profileId_updatedAt_idx"
ON "KnowledgeDocument"("profileId", "updatedAt");

CREATE INDEX "KnowledgeChunk_profileId_createdAt_idx"
ON "KnowledgeChunk"("profileId", "createdAt");

CREATE INDEX "KnowledgeChunk_documentId_chunkIndex_idx"
ON "KnowledgeChunk"("documentId", "chunkIndex");

ALTER TABLE "KnowledgeDocument"
ADD CONSTRAINT "KnowledgeDocument_profileId_fkey"
FOREIGN KEY ("profileId") REFERENCES "AiProfile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KnowledgeChunk"
ADD CONSTRAINT "KnowledgeChunk_documentId_fkey"
FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KnowledgeChunk"
ADD CONSTRAINT "KnowledgeChunk_profileId_fkey"
FOREIGN KEY ("profileId") REFERENCES "AiProfile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
