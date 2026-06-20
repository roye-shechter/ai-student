import { prisma } from "@/lib/prisma"
import {
  EMBEDDING_MODEL,
  getIndex,
  getOpenAI,
  namespaceForCourse,
  type ChunkMetadata,
} from "./clients"

/**
 * Ingestion pipeline.
 *
 * Raw text -> recursive chunks -> OpenAI embeddings -> Pinecone upsert.
 * Every upserted vector carries { userId, courseId } metadata (plus documentId
 * and chunkIndex) so retrieval can rigidly filter by tenant.
 */

export type ChunkOptions = {
  chunkSize?: number
  chunkOverlap?: number
  separators?: string[]
}

const DEFAULT_SEPARATORS = ["\n\n", "\n", ". ", " ", ""]
const DEFAULT_CHUNK_SIZE = 1000
const DEFAULT_CHUNK_OVERLAP = 200
const EMBED_BATCH = 96 // OpenAI accepts arrays; keep batches modest
const UPSERT_BATCH = 100 // Pinecone recommended max records per upsert

/**
 * Recursively split text on a descending list of separators (paragraph ->
 * line -> sentence -> word -> char), packing pieces into ~chunkSize windows
 * with overlap. Mirrors the LangChain RecursiveCharacterTextSplitter approach
 * without adding a dependency.
 */
export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE
  const chunkOverlap = options.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP
  const separators = options.separators ?? DEFAULT_SEPARATORS
  const trimmed = text.trim()
  if (!trimmed) return []
  return splitRecursive(trimmed, chunkSize, chunkOverlap, separators)
}

function splitRecursive(
  text: string,
  chunkSize: number,
  chunkOverlap: number,
  separators: string[]
): string[] {
  const finalChunks: string[] = []

  // Pick the first separator that appears in the text (fall back to "").
  let separator = separators[separators.length - 1] ?? ""
  let remainingSeparators: string[] = []
  for (let i = 0; i < separators.length; i++) {
    const s = separators[i]
    if (s === "") {
      separator = ""
      break
    }
    if (text.includes(s)) {
      separator = s
      remainingSeparators = separators.slice(i + 1)
      break
    }
  }

  const splits = separator === "" ? text.split("") : text.split(separator)

  const goodSplits: string[] = []
  for (const part of splits) {
    if (part.length < chunkSize) {
      goodSplits.push(part)
      continue
    }
    if (goodSplits.length > 0) {
      finalChunks.push(...mergeSplits(goodSplits, separator, chunkSize, chunkOverlap))
      goodSplits.length = 0
    }
    if (remainingSeparators.length === 0) {
      finalChunks.push(part)
    } else {
      finalChunks.push(...splitRecursive(part, chunkSize, chunkOverlap, remainingSeparators))
    }
  }
  if (goodSplits.length > 0) {
    finalChunks.push(...mergeSplits(goodSplits, separator, chunkSize, chunkOverlap))
  }
  return finalChunks
}

function mergeSplits(
  splits: string[],
  separator: string,
  chunkSize: number,
  chunkOverlap: number
): string[] {
  const sepLen = separator.length
  const docs: string[] = []
  let current: string[] = []
  let total = 0

  for (const part of splits) {
    const extra = current.length > 0 ? sepLen : 0
    if (total + part.length + extra > chunkSize && current.length > 0) {
      const doc = current.join(separator).trim()
      if (doc) docs.push(doc)
      // Slide the window forward, keeping `chunkOverlap` worth of tail.
      while (total > chunkOverlap && current.length > 0) {
        total -= current[0].length + (current.length > 1 ? sepLen : 0)
        current.shift()
      }
    }
    current.push(part)
    total += part.length + (current.length > 1 ? sepLen : 0)
  }
  const doc = current.join(separator).trim()
  if (doc) docs.push(doc)
  return docs
}

/** Embed a batch of texts with OpenAI text-embedding-3-small. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const openai = getOpenAI()
  const out: number[][] = []
  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const batch = texts.slice(i, i + EMBED_BATCH)
    const res = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: batch })
    for (const item of res.data) out.push(item.embedding)
  }
  return out
}

export type IngestParams = {
  userId: string
  courseId: string
  documentId: string
  text: string
  chunkOptions?: ChunkOptions
}

export type IngestResult = {
  documentId: string
  chunkCount: number
  namespace: string
}

/**
 * Chunk, embed, and upsert a document's text into Pinecone, then mark the
 * Document row as indexed in Postgres. The Document row is expected to already
 * exist (created when the file is uploaded).
 */
export async function ingestDocument(params: IngestParams): Promise<IngestResult> {
  const { userId, courseId, documentId, text, chunkOptions } = params
  const namespace = namespaceForCourse(courseId)

  await prisma.document.update({
    where: { id: documentId },
    data: { status: "processing" },
  })

  try {
    const chunks = chunkText(text, chunkOptions)
    const embeddings = await embedTexts(chunks)

    const records = chunks.map((chunk, i) => ({
      id: `${documentId}:${i}`,
      values: embeddings[i],
      metadata: {
        userId,
        courseId,
        documentId,
        chunkIndex: i,
        text: chunk,
      } satisfies ChunkMetadata,
    }))

    const index = getIndex().namespace(namespace)
    for (let i = 0; i < records.length; i += UPSERT_BATCH) {
      await index.upsert({ records: records.slice(i, i + UPSERT_BATCH) })
    }

    await prisma.document.update({
      where: { id: documentId },
      data: { status: "indexed", chunkCount: chunks.length, pineconeNamespace: namespace },
    })

    return { documentId, chunkCount: chunks.length, namespace }
  } catch (error) {
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "failed" },
    })
    throw error
  }
}
