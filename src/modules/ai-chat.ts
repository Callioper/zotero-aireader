import { apiClient, ChatResponse } from "./api-client";

export class AIChatPanel {
  private panel: Element | null = null;
  private itemId: number | null = null;
  private pdfPath: string | null = null;

  private createPanel(): Element {
    const doc = document;
    const vbox = doc.createXULElement("vbox");
    vbox.setAttribute("flex", "1");

    const title = doc.createXULElement("label");
    title.setAttribute("value", "AI 问答");
    title.setAttribute("style", "font-weight: bold; font-size: 16px;");
    vbox.appendChild(title);

    const messages = doc.createXULElement("vbox");
    messages.setAttribute("flex", "1");
    messages.setAttribute("style", "overflow: auto;");
    messages.setAttribute("id", "chat-messages");
    vbox.appendChild(messages);

    const inputBox = doc.createXULElement("hbox");
    inputBox.setAttribute("align", "center");

    const input = doc.createXULElement("textbox");
    input.setAttribute("flex", "1");
    input.setAttribute("placeholder", "输入您的问题...");
    input.setAttribute("id", "chat-input");
    input.addEventListener("keypress", (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendQuestion();
      }
    });
    inputBox.appendChild(input);

    const button = doc.createXULElement("button");
    button.setAttribute("label", "发送");
    button.addEventListener("click", () => this.sendQuestion());
    inputBox.appendChild(button);

    vbox.appendChild(inputBox);

    return vbox;
  }

  open(itemId: number, pdfPath: string) {
    if (typeof document === "undefined") return;
    this.itemId = itemId;
    this.pdfPath = pdfPath;

    const existingPanel = document.getElementById("zotero-air-chat-panel");
    if (existingPanel) {
      existingPanel.remove();
    }

    const messagesContainer = document.getElementById("chat-messages");
    if (messagesContainer) {
      messagesContainer.innerHTML = "";
    }

    if (!this.panel) {
      this.panel = this.createPanel();
    }
    this.panel.setAttribute("id", "zotero-air-chat-panel");
    document.body.appendChild(this.panel);

    this.indexDocument();
  }

  private setInputEnabled(enabled: boolean) {
    const input = document.getElementById("chat-input") as XUL.TextBox | null;
    const buttons = document.querySelectorAll("#chat-input + button");
    if (input) input.disabled = !enabled;
    buttons.forEach((btn) => ((btn as XUL.Button).disabled = !enabled));
  }

  private async indexDocument() {
    if (!this.itemId || !this.pdfPath) return;

    this.setInputEnabled(false);
    try {
      const health = await apiClient.health();
      if (health.status !== "ok") {
        this.showMessage("Backend service is not running. Please start the service.", "error");
        return;
      }

      this.showMessage("正在建立索引...", "info");
      await apiClient.indexItem(this.itemId, this.pdfPath);
      this.showMessage("索引建立完成，可以开始提问了。", "success");
    } catch (error) {
      this.showMessage(`索引失败: ${error}`, "error");
    } finally {
      this.setInputEnabled(true);
    }
  }

  private async sendQuestion() {
    const input = document.getElementById("chat-input") as XUL.TextBox;
    if (!input || !input.value.trim()) return;

    const question = input.value.trim();
    input.value = "";

    this.showMessage(`问题: ${question}`, "user");

    if (!this.itemId) return;

    this.setInputEnabled(false);
    try {
      this.showMessage("思考中...", "info");
      const response = await apiClient.chat({
        item_id: this.itemId,
        question,
        use_rag: true,
      });

      this.displayResponse(response);
    } catch (error) {
      this.showMessage(`回答失败: ${error}`, "error");
    } finally {
      this.setInputEnabled(true);
    }
  }

  private displayResponse(response: ChatResponse) {
    const doc = document;
    const messagesContainer = doc.getElementById("chat-messages");
    if (!messagesContainer) return;

    const answerBox = doc.createXULElement("vbox");
    answerBox.setAttribute("style", "margin: 10px 0; padding: 10px; background: #f5f5f5; border-radius: 5px;");

    const answerLabel = doc.createXULElement("label");
    answerLabel.setAttribute("value", `AI 回答: ${response.answer}`);
    answerLabel.setAttribute("style", "color: #333;");
    answerBox.appendChild(answerLabel);

    if (response.citations.length > 0) {
      const citationsLabel = doc.createXULElement("label");
      citationsLabel.setAttribute("value", "参考来源:");
      citationsLabel.setAttribute("style", "font-weight: bold; margin-top: 5px;");
      answerBox.appendChild(citationsLabel);

      response.citations.forEach((c) => {
        const citationText = `【${c.index}】${c.chapter_title}: ${c.quoted_text}`;
        const citationLabel = doc.createXULElement("label");
        citationLabel.setAttribute("value", citationText);
        citationLabel.setAttribute("style", "font-size: 12px; color: #666; margin-left: 10px;");
        answerBox.appendChild(citationLabel);
      });
    }

    messagesContainer.appendChild(answerBox);
  }

  private showMessage(text: string, type: "user" | "info" | "error" | "success") {
    const doc = document;
    const messagesContainer = doc.getElementById("chat-messages");
    if (!messagesContainer) return;

    const colors: Record<string, string> = {
      user: "#0078d7",
      info: "#666",
      error: "#d32f2f",
      success: "#388e3c",
    };

    const msgLabel = doc.createXULElement("label");
    msgLabel.setAttribute("value", text);
    msgLabel.setAttribute("style", `color: ${colors[type] || colors.info}; margin: 5px 0;`);

    messagesContainer.appendChild(msgLabel);
  }

  close() {
    if (typeof document === "undefined") return;
    const panel = document.getElementById("zotero-air-chat-panel");
    if (panel) {
      panel.remove();
    }
  }
}

export const aiChatPanel = new AIChatPanel();
