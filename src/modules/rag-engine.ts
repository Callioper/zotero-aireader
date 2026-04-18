/**
 * Built-in RAG Engine
 *
 * Implements Retrieval-Augmented Generation entirely within the plugin:
 * 1. Text chunking (split PDF text into overlapping chunks)
 * 2. Embedding via LLM API (OpenAI/Ollama embedding endpoints)
 * 3. In-memory vector store with cosine similarity search
 * 4. BM25 keyword fallback when embeddings are unavailable
 * 5. Context building for LLM prompts
 *
 * Key design: embedding failures never block the user. If a batch fails,
 * it is skipped and the engine falls back to BM25 for those chunks.
 */

import { llmEmbed, LLMEmbedOptions } from "./llm-client";

// ─── Types ──────────────────────────────────────────────────

interface TextChunk {
  text: string;
  index: number;
  /** Estimated page number (0-indexed, best effort) */
  pageEstimate: number;
}

interface IndexedChunk extends TextChunk {
  embedding: number[] | null; // null = embedding failed for this chunk
}

interface SearchResult {
  chunk: TextChunk;
  score: number;
}

/** In-memory index for a single document */
interface DocumentIndex {
  itemId: number;
  chunks: IndexedChunk[];
  fullText: string;
  indexed: boolean;
  /** True if at least some chunks have embeddings */
  hasEmbeddings: boolean;
}

// ─── Configuration ──────────────────────────────────────────

const CHUNK_SIZE = 500;        // characters per chunk
const CHUNK_OVERLAP = 100;     // overlap between chunks
const EMBED_BATCH_SIZE = 20;   // chunks per embedding API call
const INDEX_TOTAL_TIMEOUT = 90_000; // 90s max for entire indexing

// ─── RAG Engine ─────────────────────────────────────────────

class RAGEngine {
  private indices: Map<number, DocumentIndex> = new Map();

  /**
   * Index a document's text for RAG search.
   * Chunks the text and computes embeddings via the configured API.
   *
   * Batch failures are tolerated — failed batches get null embeddings
   * and the engine falls back to BM25 for search.
   */
  async indexDocument(itemId: number, fullText: string): Promise<void> {
    if (this.indices.has(itemId)) {
      const existing = this.indices.get(itemId)!;
      if (existing.indexed) {
        Zotero.debug(`AI Reader RAG: document ${itemId} already indexed`);
        return;
      }
    }

    Zotero.debug(`AI Reader RAG: indexing document ${itemId} (${fullText.length} chars)`);

    // Step 1: Chunk the text
    const chunks = chunkText(fullText, CHUNK_SIZE, CHUNK_OVERLAP);
    Zotero.debug(`AI Reader RAG: created ${chunks.length} chunks`);

    // Step 2: Compute embeddings in batches with per-batch error tolerance
    const indexedChunks: IndexedChunk[] = [];
    let embeddedCount = 0;
    const startTime = Date.now();

    for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
      // Check total timeout
      if (Date.now() - startTime > INDEX_TOTAL_TIMEOUT) {
        Zotero.debug(`AI Reader RAG: indexing timeout after ${i} chunks, remaining will use BM25`);
        // Push remaining chunks without embeddings
        for (let j = i; j < chunks.length; j++) {
          indexedChunks.push({ ...chunks[j], embedding: null });
        }
        break;
      }

      const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
      const texts = batch.map((c) => c.text);

      try {
        const embeddings = await llmEmbed(texts);
        for (let j = 0; j < batch.length; j++) {
          indexedChunks.push({
            ...batch[j],
            embedding: embeddings[j] || null,
          });
          if (embeddings[j]) embeddedCount++;
        }
      } catch (e) {
        // Batch failed — push chunks with null embeddings, continue
        Zotero.debug(`AI Reader RAG: batch ${i}-${i + batch.length} embedding failed: ${e}`);
        for (const chunk of batch) {
          indexedChunks.push({ ...chunk, embedding: null });
        }
      }
    }

    this.indices.set(itemId, {
      itemId,
      chunks: indexedChunks,
      fullText,
      indexed: true,
      hasEmbeddings: embeddedCount > 0,
    });

    Zotero.debug(`AI Reader RAG: indexed ${indexedChunks.length} chunks, ${embeddedCount} with embeddings`);
  }

  /**
   * Non-blocking indexing — fires and forgets.
   * Returns immediately; indexing runs in background.
   * Use `isIndexed()` to check completion.
   */
  indexDocumentAsync(itemId: number, fullText: string): void {
    this.indexDocument(itemId, fullText).catch((e) => {
      Zotero.debug(`AI Reader RAG: async indexing failed for ${itemId}: ${e}`);
    });
  }

  /**
   * Search for relevant chunks using vector similarity or BM25 fallback.
   */
  async search(itemId: number, query: string, topK: number = 5): Promise<SearchResult[]> {
    const index = this.indices.get(itemId);
    if (!index || !index.indexed) return [];

    // Try vector search first if we have embeddings
    if (index.hasEmbeddings) {
      try {
        const queryEmbedding = await llmEmbed([query]);
        if (queryEmbedding[0]) {
          return vectorSearch(index.chunks, queryEmbedding[0], topK);
        }
      } catch (e) {
        Zotero.debug(`AI Reader RAG: query embedding failed, falling back to BM25: ${e}`);
      }
    }

    // BM25 keyword fallback
    return bm25Search(index.chunks, query, topK);
  }

  /**
   * Build a context string from search results for LLM prompts.
   */
  buildContext(results: SearchResult[]): string {
    if (results.length === 0) return "";

    const contextParts = results.map((r, i) =>
      `[${i + 1}] (相关度: ${(r.score * 100).toFixed(0)}%)\n${r.chunk.text}`,
    );

    return `参考材料:\n${contextParts.join("\n\n")}`;
  }

  /** Check if a document has been indexed */
  isIndexed(itemId: number): boolean {
    return this.indices.get(itemId)?.indexed === true;
  }

  /** Check if a document has vector embeddings (not just BM25) */
  hasEmbeddings(itemId: number): boolean {
    return this.indices.get(itemId)?.hasEmbeddings === true;
  }

  /** Clear index for a specific document */
  clearIndex(itemId: number): void {
    this.indices.delete(itemId);
  }
}

// ─── Text Chunking ──────────────────────────────────────────

function chunkText(text: string, chunkSize: number, overlap: number): TextChunk[] {
  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 0;

  // Rough page estimation: ~3000 chars per page
  const charsPerPage = 3000;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunkText = text.substring(start, end);

    chunks.push({
      text: chunkText,
      index,
      pageEstimate: Math.floor(start / charsPerPage),
    });

    start += chunkSize - overlap;
    index++;
  }

  return chunks;
}

// ─── Vector Search ──────────────────────────────────────────

function vectorSearch(chunks: IndexedChunk[], queryEmbedding: number[], topK: number): SearchResult[] {
  const scored: SearchResult[] = [];

  for (const chunk of chunks) {
    if (!chunk.embedding) continue;
    const score = cosineSimilarity(queryEmbedding, chunk.embedding);
    scored.push({ chunk, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ─── BM25 Keyword Search ────────────────────────────────────

function bm25Search(chunks: IndexedChunk[], query: string, topK: number): SearchResult[] {
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return [];

  const scored: SearchResult[] = [];
  const totalDocs = chunks.length;

  for (const chunk of chunks) {
    const docTerms = tokenize(chunk.text);
    const score = bm25Score(queryTerms, docTerms, totalDocs);
    if (score > 0) {
      scored.push({ chunk, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function bm25Score(queryTerms: string[], docTerms: string[], totalDocs: number): number {
  const k1 = 1.2;
  const b = 0.75;
  const avgDL = 100;
  const dl = docTerms.length;

  const termFreq = new Map<string, number>();
  for (const t of docTerms) {
    termFreq.set(t, (termFreq.get(t) || 0) + 1);
  }

  let score = 0;
  for (const term of queryTerms) {
    const tf = termFreq.get(term) || 0;
    if (tf === 0) continue;

    // Simplified IDF (assuming term appears in ~10% of chunks)
    const idf = Math.log((totalDocs + 1) / (totalDocs * 0.1 + 1));
    const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (dl / avgDL)));
    score += idf * tfNorm;
  }

  // Normalize to 0-1 range
  return Math.min(score / (queryTerms.length * 2), 1);
}

// ─── Singleton Export ───────────────────────────────────────

export const ragEngine = new RAGEngine();
