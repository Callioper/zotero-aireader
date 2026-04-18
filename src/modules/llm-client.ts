/**
 * Built-in LLM Client
 *
 * Calls OpenAI-compatible API endpoints directly from the plugin.
 * Supports: OpenAI, DeepSeek, Ollama, LM Studio, Claude (via proxy), any OpenAI-compatible server.
 *
 * No Python backend required.
 */

import { getPref } from "../utils/prefs";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMChatOptions {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface LLMEmbeddingResult {
  embedding: number[];
}

/** Provider-specific endpoint configuration */
interface ProviderConfig {
  chatPath: string;
  embeddingPath: string;
  authHeader: (apiKey: string) => Record<string, string>;
  chatBodyTransform?: (body: any) => any;
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
    chatBodyTransform: (body: any) => {
      // Ollama's OpenAI-compatible endpoint works as-is
      return body;
    },
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

/**
 * Chat completion - call LLM with messages.
 */
export async function llmChat(options: LLMChatOptions): Promise<string> {
  const { baseUrl, apiKey, model, provider } = getConfig();
  const providerCfg = PROVIDER_CONFIGS[provider] || PROVIDER_CONFIGS["openai-compatible"];

  const url = baseUrl.replace(/\/$/, "") + providerCfg.chatPath;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...providerCfg.authHeader(apiKey),
  };

  let body: any = {
    model,
    messages: options.messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 4096,
  };

  if (providerCfg.chatBodyTransform) {
    body = providerCfg.chatBodyTransform(body);
  }

  Zotero.debug(`AI Reader LLM: POST ${url} model=${model}`);

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

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
 * Get text embeddings from the configured API.
 */
export async function llmEmbed(texts: string[]): Promise<number[][]> {
  const { baseUrl, apiKey, embeddingModel, provider } = getConfig();
  const providerCfg = PROVIDER_CONFIGS[provider] || PROVIDER_CONFIGS["openai-compatible"];

  const url = baseUrl.replace(/\/$/, "") + providerCfg.embeddingPath;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...providerCfg.authHeader(apiKey),
  };

  // Ollama uses a different embedding API format
  if (provider === "ollama") {
    return await ollamaEmbed(url, headers, texts, embeddingModel);
  }

  // OpenAI-compatible embedding API
  const body = {
    model: embeddingModel,
    input: texts,
  };

  Zotero.debug(`AI Reader Embed: POST ${url} model=${embeddingModel} texts=${texts.length}`);

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

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
): Promise<number[][]> {
  const results: number[][] = [];

  // Ollama /api/embed supports batch via "input" array
  const body = {
    model,
    input: texts,
  };

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Ollama embed error ${response.status}: ${errText}`);
  }

  const data = await response.json();

  // Ollama returns { embeddings: [[...], [...]] }
  if (data.embeddings && Array.isArray(data.embeddings)) {
    return data.embeddings;
  }

  // Single embedding fallback
  if (data.embedding) {
    return [data.embedding];
  }

  throw new Error("Unexpected Ollama embedding response format");
}

/**
 * Test the LLM connection by sending a simple ping.
 */
export async function llmHealthCheck(): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await llmChat({
      messages: [{ role: "user", content: "Hi, reply with just 'ok'" }],
      maxTokens: 10,
    });
    return { ok: !!result };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
