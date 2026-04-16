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

  async health(): Promise<{ status: string }> {
    const response = await fetch(`${this.baseUrl}/../health`);
    return response.json();
  }
}

export const apiClient = new APIClient();