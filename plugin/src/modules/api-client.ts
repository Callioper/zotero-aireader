const API_BASE = "http://127.0.0.1:8765/api";

export interface ChatRequest {
  item_id: number;
  question: string;
  use_rag: boolean;
  provider?: string;
  model?: string;
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
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl;
  }

  async indexItem(itemId: number, pdfPath: string): Promise<IndexResponse> {
    const response = await fetch(`${this.baseUrl}/index`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: itemId, pdf_path: pdfPath }),
    });
    return response.json();
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const response = await fetch(`${this.baseUrl}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    return response.json();
  }

  async search(q: string, itemId?: number, limit?: number): Promise<{ results: SearchResult[] }> {
    const params = new URLSearchParams({ q });
    if (itemId !== undefined) params.append("item_id", String(itemId));
    if (limit !== undefined) params.append("limit", String(limit));

    const response = await fetch(`${this.baseUrl}/search?${params}`);
    return response.json();
  }

  async health(): Promise<{ status: string }> {
    const response = await fetch(`${this.baseUrl}/../health`);
    return response.json();
  }
}

export const apiClient = new APIClient();
