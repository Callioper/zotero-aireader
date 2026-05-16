/**
 * Built-in LLM Client
 *
 * Calls OpenAI-compatible API endpoints directly from the plugin.
 * Supports: OpenAI, DeepSeek, Ollama, LM Studio, any OpenAI-compatible server.
 *
 * All fetch calls use AbortController for timeout control to prevent
 * blocking the Zotero main thread.
 */

import { getPref } from "../utils/prefs";

// ─── Timeout defaults (ms) ─────────────────────────────────
const CHAT_TIMEOUT = 60_000;       // 60s for chat completions
const STREAM_TIMEOUT = 300_000;    // 5min for streaming (initial connection only)
const EMBED_TIMEOUT = 30_000;      // 30s for embedding
const HEALTH_CHECK_TIMEOUT = 8_000; // 8s for health checks

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMChatOptions {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Override timeout in ms */
  timeout?: number;
}

export interface LLMEmbedOptions {
  /** Override timeout in ms */
  timeout?: number;
}

/** Provider-specific endpoint configuration */
interface ProviderConfig {
  chatPath: string;
  embeddingPath: string;
  authHeader: (apiKey: string) => Record<string, string>;
}

const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  openai: {
    chatPath: "/v1/chat/completions",
    embeddingPath: "/v1/embeddings",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  deepseek: {
    chatPath: "/v1/chat/completions",
    embeddingPath: "/v1/embeddings",
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  ollama: {
    chatPath: "/v1/chat/completions",
    embeddingPath: "/api/embed",
    authHeader: () => ({}),
  },
  lmstudio: {
    chatPath: "/v1/chat/completions",
    embeddingPath: "/v1/embeddings",
    authHeader: () => ({}),
  },
  "openai-compatible": {
    chatPath: "/v1/chat/completions",
    embeddingPath: "/v1/embeddings",
    authHeader: (key) => (key ? { Authorization: `Bearer ${key}` } : {}),
  },
};

function getConfig(): { baseUrl: string; apiKey: string; model: string; embeddingModel: string; provider: string } {
  const provider = (getPref("llmProvider") as string) || "ollama";
  const baseUrl = (getPref("apiBaseUrl") as string) || getDefaultBaseUrl(provider);
  const apiKey = (getPref("apiKey") as string) || "";
  const model = (getPref("modelName") as string) || getDefaultModel(provider);
  const embeddingModel = (getPref("embeddingModel") as string) || getDefaultEmbeddingModel(provider);
  return { baseUrl, apiKey, model, embeddingModel, provider };
}

interface EmbeddingConfig {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

function getEmbeddingConfig(): EmbeddingConfig {
  // Check if embedding has its own provider or uses chat provider
  const embeddingProvider = (getPref("embeddingProvider") as string) || "same";
  const provider = embeddingProvider === "same" ? (getPref("llmProvider") as string) || "ollama" : embeddingProvider;

  // Get base URL - use embedding-specific or fall back to chat
  let baseUrl = (getPref("embeddingBaseUrl") as string) || "";
  if (!baseUrl) {
    baseUrl = (getPref("apiBaseUrl") as string) || getDefaultBaseUrl(provider);
  }

  // Get API key - use embedding-specific or fall back to chat
  let apiKey = (getPref("embeddingApiKey") as string) || "";
  if (!apiKey) {
    apiKey = (getPref("apiKey") as string) || "";
  }

  // Get model
  const model = (getPref("embeddingModel") as string) || getDefaultEmbeddingModel(provider);

  return { provider, baseUrl, apiKey, model };
}

function getDefaultBaseUrl(provider: string): string {
  switch (provider) {
    case "openai": return "https://api.openai.com";
    case "deepseek": return "https://api.deepseek.com";
    case "ollama": return "http://127.0.0.1:11434";
    case "lmstudio": return "http://127.0.0.1:1234";
    default: return "http://127.0.0.1:11434";
  }
}

function getDefaultModel(provider: string): string {
  switch (provider) {
    case "openai": return "gpt-4o-mini";
    case "deepseek": return "deepseek-chat";
    case "ollama": return "llama3";
    case "lmstudio": return "default";
    default: return "";
  }
}

function getDefaultEmbeddingModel(provider: string): string {
  switch (provider) {
    case "openai": return "text-embedding-3-small";
    case "deepseek": return "text-embedding-3-small";
    case "ollama": return "nomic-embed-text";
    case "lmstudio": return "text-embedding-nomic-embed-text-v1.5";
    default: return "nomic-embed-text";
  }
}

// ─── Timeout-aware fetch ────────────────────────────────────

function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

// ─── Chat ───────────────────────────────────────────────────

/**
 * Chat completion - call LLM with messages.
 * Has built-in timeout (default 60s) to prevent blocking.
 */
export async function llmChat(options: LLMChatOptions): Promise<string> {
  const { baseUrl, apiKey, model, provider } = getConfig();
  const providerCfg = PROVIDER_CONFIGS[provider] || PROVIDER_CONFIGS["openai-compatible"];

  const url = baseUrl.replace(/\/$/, "") + providerCfg.chatPath;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...providerCfg.authHeader(apiKey),
  };

  const body: any = {
    model,
    messages: options.messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 4096,
  };

  Zotero.debug(`AI Reader LLM: POST ${url} model=${model}`);

  const timeout = options.timeout ?? CHAT_TIMEOUT;
  let response: Response;
  try {
    response = await fetchWithTimeout(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }, timeout);
  } catch (e: any) {
    if (e.name === "AbortError") {
      throw new Error(`Chat request timed out after ${timeout / 1000}s — check if the LLM service is running`);
    }
    throw e;
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LLM API error ${response.status}: ${errText}`);
  }

  const data = await response.json();

  // OpenAI-compatible format
  if (data.choices && data.choices[0]?.message?.content) {
    return data.choices[0].message.content;
  }

  // Ollama native format fallback
  if (data.message?.content) {
    return data.message.content;
  }

  throw new Error("Unexpected LLM response format: " + JSON.stringify(data).substring(0, 200));
}

/**
 * Streaming chat completion - calls onToken for each received token.
 * Uses a longer timeout for initial connection only; the stream stays open.
 */
export async function llmChatStream(
  options: LLMChatOptions,
  onToken: (token: string) => void,
): Promise<string> {
  const { baseUrl, apiKey, model, provider } = getConfig();
  const providerCfg = PROVIDER_CONFIGS[provider] || PROVIDER_CONFIGS["openai-compatible"];

  const url = baseUrl.replace(/\/$/, "") + providerCfg.chatPath;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...providerCfg.authHeader(apiKey),
  };

  const body: any = {
    model,
    messages: options.messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 4096,
    stream: true,
  };

  Zotero.debug(`AI Reader LLM Stream: POST ${url} model=${model}`);

  const response = await Promise.race([
    fetch(url, { method: "POST", headers, body: JSON.stringify(body) }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Stream request timed out after ${STREAM_TIMEOUT / 1000}s`)), STREAM_TIMEOUT)
    ),
  ]);

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LLM API error ${response.status}: ${errText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Response body is not readable (streaming not supported)");
  }

  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) continue;

      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") continue;

      try {
        const parsed = JSON.parse(data);
        let token: string | undefined;

        if (parsed.choices?.[0]?.delta?.content) {
          token = parsed.choices[0].delta.content;
        } else if (parsed.message?.content) {
          token = parsed.message.content;
        }

        if (token) {
          fullText += token;
          onToken(token);
        }
      } catch {
        // Skip malformed JSON lines
      }
    }
  }

  return fullText;
}

// ─── Embedding ──────────────────────────────────────────────

/**
 * Get text embeddings from the configured API.
 * Has built-in timeout (default 30s) to prevent blocking.
 */
export async function llmEmbed(texts: string[], options?: LLMEmbedOptions): Promise<number[][]> {
  const embedConfig = getEmbeddingConfig();
  const providerCfg = PROVIDER_CONFIGS[embedConfig.provider] || PROVIDER_CONFIGS["openai-compatible"];

  const url = embedConfig.baseUrl.replace(/\/$/, "") + providerCfg.embeddingPath;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...providerCfg.authHeader(embedConfig.apiKey),
  };

  const timeout = options?.timeout ?? EMBED_TIMEOUT;

  // Ollama uses a different embedding API format
  if (embedConfig.provider === "ollama") {
    return await ollamaEmbed(url, headers, texts, embedConfig.model, timeout);
  }

  // OpenAI-compatible embedding API
  const body = {
    model: embedConfig.model,
    input: texts,
  };

  Zotero.debug(`AI Reader Embed: POST ${url} model=${embedConfig.model} texts=${texts.length}`);

  let response: Response;
  try {
    response = await fetchWithTimeout(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }, timeout);
  } catch (e: any) {
    if (e.name === "AbortError") {
      throw new Error(`Embedding request timed out after ${timeout / 1000}s`);
    }
    throw e;
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Embedding API error ${response.status}: ${errText}`);
  }

  const data = await response.json();

  if (data.data && Array.isArray(data.data)) {
    return data.data.map((d: any) => d.embedding);
  }

  throw new Error("Unexpected embedding response format");
}

/** Ollama-specific embedding API */
async function ollamaEmbed(
  url: string,
  headers: Record<string, string>,
  texts: string[],
  model: string,
  timeout: number,
): Promise<number[][]> {
  const body = {
    model,
    input: texts,
  };

  let response: Response;
  try {
    response = await fetchWithTimeout(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }, timeout);
  } catch (e: any) {
    if (e.name === "AbortError") {
      throw new Error(`Ollama embedding timed out after ${timeout / 1000}s`);
    }
    throw e;
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Ollama embed error ${response.status}: ${errText}`);
  }

  const data = await response.json();

  if (data.embeddings && Array.isArray(data.embeddings)) {
    return data.embeddings;
  }

  if (data.embedding) {
    return [data.embedding];
  }

  throw new Error("Unexpected Ollama embedding response format");
}

// ─── Health Checks ──────────────────────────────────────────

/**
 * Test Chat LLM connectivity. Fast timeout (8s).
 */
export async function llmChatHealthCheck(): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await llmChat({
      messages: [{ role: "user", content: "Hi, reply with just 'ok'" }],
      maxTokens: 10,
      timeout: HEALTH_CHECK_TIMEOUT,
    });
    return { ok: !!result };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/**
 * Test Embedding API connectivity. Fast timeout (8s).
 */
export async function llmEmbedHealthCheck(): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await llmEmbed(["test"], { timeout: HEALTH_CHECK_TIMEOUT });
    return { ok: Array.isArray(result) && result.length > 0 };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** Check if chat model appears to be configured (non-empty provider + base URL) */
export function isChatConfigured(): boolean {
  const { baseUrl, model } = getConfig();
  return !!(baseUrl && model);
}


