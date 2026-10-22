-- The `embedding` column is declared as `Unsupported("vector(1536)")` in
-- schema.prisma, so Prisma's own migration diffing never sees or manages
-- this index (see the HNSW note in CLAUDE.md). Recording it explicitly here
-- means a fresh `prisma migrate deploy` (a new environment, disaster
-- recovery, a reset local DB) creates it automatically instead of relying on
-- someone remembering to run it by hand.
--
-- CONCURRENTLY avoids locking document_chunks for writes while it builds;
-- IF NOT EXISTS makes this safe to apply even if the index is already
-- present (as it was on the database this migration was baselined from).
CREATE INDEX CONCURRENTLY IF NOT EXISTS document_chunks_embedding_hnsw
  ON document_chunks USING hnsw (embedding vector_cosine_ops);
