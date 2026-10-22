-- DropIndex
DROP INDEX "document_chunks_embedding_hnsw";

-- CreateTable
CREATE TABLE "chat_weak_signals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_weak_signals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_weak_signals_userId_courseId_createdAt_idx" ON "chat_weak_signals"("userId", "courseId", "createdAt");
