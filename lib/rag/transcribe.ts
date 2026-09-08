import { getOpenAI, TRANSCRIPTION_MODEL } from "./clients"

/**
 * Lecture recording ingestion. Transcribes an audio file via OpenAI's
 * speech-to-text (the same client already used for embeddings — no new
 * vendor), then hands the transcript to the existing ingestDocument()
 * pipeline (lib/rag/ingest.ts) unchanged: chunk → embed → Pinecone, exactly
 * like a PDF/TXT upload. This is the entire integration surface — the RAG
 * pipeline downstream has no idea the text originated from audio.
 *
 * OpenAI's transcription endpoint hard-caps uploads at 25MB; callers must
 * enforce a stricter limit themselves (see MAX_AUDIO_BYTES in
 * app/api/upload/finalize/route.ts) since this function does not re-check size.
 */
export async function transcribeAudio(file: File): Promise<string> {
  const openai = getOpenAI()
  const transcription = await openai.audio.transcriptions.create({
    file,
    model: TRANSCRIPTION_MODEL,
  })
  return transcription.text
}
