import { getApiUrl, getLLMProvider, getModelName } from "../utils/prefs";

const DEFAULT_API_BASE = "http://127.0.0.1:8765/api";

function getApiBase(): string {
  try {
    return getApiUrl();
  } catch {
    return DEFAULT_API_BASE;
  }
}

export interface ChatRequest {
  item_id: number;
  question: string;
  use_rag: boolean;
  provider?: string;
  model?: string;
  skill_prompt?: string;
}

export interface ChatResponse {
  answer: string;
  citations: Citation[];
}

export interface Citation {
  index: number;
  chapter_title: string;
  chapter_index: number;
  page_num: number | null;
  quoted_text: string;
  reasoning: string;
}

export interface IndexResponse {
  status: string;
  message: string;
}

export interface SearchResult {
  content: string;
  item_id: number;
  chapter_title: string;
  score: number;
}

export class APIClient {
  private getBaseUrl(): string {
    return getApiBase();
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error ${response.status}: ${error || response.statusText}`);
    }
    return response.json();
  }

  async indexItem(itemId: number, pdfPath: string): Promise<IndexResponse> {
    const response = await fetch(`${this.getBaseUrl()}/index`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: itemId, pdf_path: pdfPath }),
    });
    return this.handleResponse(response);
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    // Inject provider/model from preferences if not explicitly set
    const payload = { ...request };
    if (!payload.provider) {
      const provider = getLLMProvider();
      if (provider) payload.provider = provider;
    }
    if (!payload.model) {
      const model = getModelName();
      if (model) payload.model = model;
    }

    const response = await fetch(`${this.getBaseUrl()}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return this.handleResponse(response);
  }

  async search(q: string, itemId?: number, limit?: number): Promise<{ results: SearchResult[] }> {
    const params = new URLSearchParams({ q });
    if (itemId !== undefined) params.append("item_id", String(itemId));
    if (limit !== undefined) params.append("limit", String(limit));

    const response = await fetch(`${this.getBaseUrl()}/search?${params}`);
    return this.handleResponse(response);
  }

  async health(): Promise<{ status: string }> {
    const base = this.getBaseUrl();
    const healthUrl = base.replace('/api', '') + '/health';
    const response = await fetch(healthUrl);
    return this.handleResponse(response);
  }
}

export const apiClient = new APIClient();
