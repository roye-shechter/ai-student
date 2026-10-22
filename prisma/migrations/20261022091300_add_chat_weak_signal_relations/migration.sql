-- AddForeignKey
ALTER TABLE "chat_weak_signals" ADD CONSTRAINT "chat_weak_signals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_weak_signals" ADD CONSTRAINT "chat_weak_signals_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
