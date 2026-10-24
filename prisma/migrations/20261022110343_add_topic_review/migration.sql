-- CreateTable
CREATE TABLE "topic_reviews" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "intervalDays" INTEGER NOT NULL DEFAULT 1,
    "nextReviewAt" TIMESTAMP(3) NOT NULL,
    "lastResult" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topic_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "topic_reviews_userId_courseId_nextReviewAt_idx" ON "topic_reviews"("userId", "courseId", "nextReviewAt");

-- CreateIndex
CREATE UNIQUE INDEX "topic_reviews_userId_courseId_topic_key" ON "topic_reviews"("userId", "courseId", "topic");

-- AddForeignKey
ALTER TABLE "topic_reviews" ADD CONSTRAINT "topic_reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_reviews" ADD CONSTRAINT "topic_reviews_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
