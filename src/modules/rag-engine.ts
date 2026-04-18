/**
 * Built-in RAG Engine
 *
 * Implements Retrieval-Augmented Generation entirely within the plugin:
 * 1. Text chunking (split PDF text into overlapping chunks)
 * 2. Embedding via LLM API (OpenAI/Ollama embedding endpoints)
 * 3. In-memory vector store with cosine similarity search
 * 4. Context building for LLM prompts
 *
 * No external database or Python backend required.
 */

import { llmEmbed } from "./llm-client";

// ─── Types ──────────────────────────────────────────────────

interface TextChunk {
  text: string;
  index: number;
  /** Estimated page number (0-indexed, best effort) */
  pageEstimate: number;
}

interface IndexedChunk extends TextChunk {
  embedding: number[];
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
}

// ─── Configuration ──────────────────────────────────────────

const CHUNK_SIZE = 500;        // characters per chunk
const CHUNK_OVERLAP = 100;     // overlap between chunks
const EMBED_BATCH_SIZE = 20;   // chunks per embedding API call

// ─── RAG Engine ─────────────────────────────────────────────

class RAGEngine {
  private indices: Map<number, DocumentIndex> = new Map();

  /**
   * Index a document's text for RAG search.
   * Chunks the text and computes embeddings via the configured API.
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

    // Step 2: Compute embeddings in batches
    const indexedChunks: IndexedChunk[] = [];
    for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
      const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
      const texts = batch.map((c) => c.text);

      try {
        const embeddings = await llmEmbed(texts);
        for (let j = 0; j < batch.length; j++) {
          indexedChunks.push({
            ...batch[j],
            embedding: embeddings[j],
          });
        }
      } catch (e) {
        Zotero.debug(`AI Reader RAG: embedding batch ${i} failed: ${e}`);
        // Fall back: store chunks without embeddings (will use keyword search)
        for (const chunk of batch) {
          indexedChunks.push({
            ...chunk,
            embedding: [],
          });
        }
      }
    }

    this.indices.set(itemId, {
      itemId,
      chunks: indexedChunks,
      fullText,
      indexed: true,
    });

    const embeddedCount = indexedChunks.filter((c) => c.embedding.length > 0).length;
    Zotero.debug(`AI Reader RAG: indexed ${indexedChunks.length} chunks (${embeddedCount} with embeddings)`);
  }

  /**
   * Search for relevant chunks using the query.
   * Uses embedding-based cosine similarity when available,
   * falls back to keyword matching otherwise.
   */
  async search(itemId: number, query: string, topK: number = 5): Promise<SearchResult[]> {
    const index = this.indices.get(itemId);
    if (!index || !index.indexed) {
      Zotero.debug(`AI Reader RAG: no index for item ${itemId}`);
      return [];
    }

    const hasEmbeddings = index.chunks.some((c) => c.embedding.length > 0);

    if (hasEmbeddings) {
      return await this.embeddingSearch(index, query, topK);
    }

    // Fallback: keyword-based search
    return this.keywordSearch(index, query, topK);
  }

  /**
   * Build a context string from search results for inclusion in LLM prompts.
   */
  buildContext(results: SearchResult[]): string {
    if (results.length === 0) return "";

    const parts = results.map((r, i) => {
      return `[${i + 1}] (相关度: ${(r.score * 100).toFixed(0)}%) ${r.chunk.text}`;
    });

    return "参考材料:\n\n" + parts.join("\n\n");
  }

  /**
   * Check if a document is already indexed.
   */
  isIndexed(itemId: number): boolean {
    return this.indices.get(itemId)?.indexed === true;
  }

  /**
   * Clear the index for a document.
   */
  clearIndex(itemId: number) {
    this.indices.delete(itemId);
  }

  /**
   * Clear all indices.
   */
  clearAll() {
    this.indices.clear();
  }

  // ─── Private Search Methods ─────────────────────────────

  private async embeddingSearch(index: DocumentIndex, query: string, topK: number): Promise<SearchResult[]> {
    try {
      const [queryEmbedding] = await llmEmbed([query]);

      const scored = index.chunks
        .filter((c) => c.embedding.length > 0)
        .map((chunk) => ({
          chunk,
          score: cosineSimilarity(queryEmbedding, chunk.embedding),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

      return scored;
    } catch (e) {
      Zotero.debug(`AI Reader RAG: embedding search failed, falling back to keywords: ${e}`);
      return this.keywordSearch(index, query, topK);
    }
  }

  private keywordSearch(index: DocumentIndex, query: string, topK: number): SearchResult[] {
    // Simple BM25-like keyword scoring
    const queryTerms = tokenize(query);

    const scored = index.chunks.map((chunk) => {
      const chunkTerms = tokenize(chunk.text);
      const score = bm25Score(queryTerms, chunkTerms, index.chunks.length);
      return { chunk, score };
    });

    return scored
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}

// ─── Text Chunking ──────────────────────────────────────────

function chunkText(text: string, chunkSize: number, overlap: number): TextChunk[] {
  const chunks: TextChunk[] = [];
  const totalLen = text.length;

  // Estimate pages: assume ~3000 chars per page
  const charsPerPage = 3000;

  let start = 0;
  let index = 0;

  while (start < totalLen) {
    let end = Math.min(start + chunkSize, totalLen);

    // Try to break at sentence boundary
    if (end < totalLen) {
      const breakPoints = [
        text.lastIndexOf("。", end),
        text.lastIndexOf(". ", end),
        text.lastIndexOf(".\n", end),
        text.lastIndexOf("\n\n", end),
        text.lastIndexOf("\n", end),
      ];

      for (const bp of breakPoints) {
        if (bp > start + chunkSize * 0.5) {
          end = bp + 1;
          break;
        }
      }
    }

    const chunkText = text.substring(start, end).trim();
    if (chunkText.length > 20) {
      chunks.push({
        text: chunkText,
        index,
        pageEstimate: Math.floor(start / charsPerPage),
      });
      index++;
    }

    start = end - overlap;
    if (start >= totalLen) break;
  }

  return chunks;
}

// ─── Math Utilities ─────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dotProduct / denom;
}

// ─── BM25 Keyword Search ────────────────────────────────────

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
