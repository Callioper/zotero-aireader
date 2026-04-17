import { apiClient, ChatResponse } from "./api-client";

export class AIChatPanel {
  private panel: any;
  private itemId: number | null = null;
  private pdfPath: string | null = null;

  constructor() {
    this.panel = this.createPanel();
  }

  private createPanel() {
    return ztoolkit.createElement(document, "vbox", {
      namespace: "xul",
      attributes: { flex: "1" },
      children: [
        {
          tag: "label",
          attributes: { value: "AI 问答", style: "font-weight: bold; font-size: 16px;" },
        },
        {
          tag: "vbox",
          attributes: { flex: "1", style: "overflow: auto;" },
          children: [],
          id: "chat-messages",
        },
        {
          tag: "hbox",
          attributes: { align: "center" },
          children: [
            {
              tag: "textbox",
              attributes: { flex: "1", placeholder: "输入您的问题..." },
              id: "chat-input",
              listeners: [
                {
                  type: "keypress",
                  listener: (e: KeyboardEvent) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      this.sendQuestion();
                    }
                  },
                },
              ],
            },
            {
              tag: "button",
              attributes: { label: "发送" },
              listeners: [
                {
                  type: "click",
                  listener: () => this.sendQuestion(),
                },
              ],
            },
          ],
        },
      ],
    });
  }

  async open(itemId: number, pdfPath: string) {
    this.itemId = itemId;
    this.pdfPath = pdfPath;

    const existingPanel = document.getElementById("zotero-air-chat-panel");
    if (existingPanel) {
      existingPanel.remove();
    }

    this.panel.id = "zotero-air-chat-panel";
    ztoolkit.append(document.body, this.panel);

    await this.indexDocument();
  }

  private async indexDocument() {
    if (!this.itemId || !this.pdfPath) return;

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
    }
  }

  private async sendQuestion() {
    const input = document.getElementById("chat-input") as XUL.TextBox;
    if (!input || !input.value.trim()) return;

    const question = input.value.trim();
    input.value = "";

    this.showMessage(`问题: ${question}`, "user");

    if (!this.itemId) return;

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
    }
  }

  private displayResponse(response: ChatResponse) {
    const messagesContainer = document.getElementById("chat-messages");
    if (!messagesContainer) return;

    const answerBox = ztoolkit.createElement(document, "vbox", {
      attributes: { style: "margin: 10px 0; padding: 10px; background: #f5f5f5; border-radius: 5px;" },
    });

    answerBox.appendChild(
      ztoolkit.createElement(document, "label", {
        attributes: {
          value: `AI 回答: ${response.answer}`,
          style: "color: #333;",
        },
      })
    );

    if (response.citations.length > 0) {
      const citationsLabel = ztoolkit.createElement(document, "label", {
        attributes: {
          value: "参考来源:",
          style: "font-weight: bold; margin-top: 5px;",
        },
      });
      answerBox.appendChild(citationsLabel);

      response.citations.forEach((c) => {
        const citationText = `【${c.index}】${c.chapter_title}: ${c.quoted_text}`;
        answerBox.appendChild(
          ztoolkit.createElement(document, "label", {
            attributes: {
              value: citationText,
              style: "font-size: 12px; color: #666; margin-left: 10px;",
            },
          })
        );
      });
    }

    messagesContainer.appendChild(answerBox);
  }

  private showMessage(text: string, type: "user" | "info" | "error" | "success") {
    const messagesContainer = document.getElementById("chat-messages");
    if (!messagesContainer) return;

    const colors: Record<string, string> = {
      user: "#0078d7",
      info: "#666",
      error: "#d32f2f",
      success: "#388e3c",
    };

    const msgLabel = ztoolkit.createElement(document, "label", {
      attributes: {
        value: text,
        style: `color: ${colors[type] || colors.info}; margin: 5px 0;`,
      },
    });

    messagesContainer.appendChild(msgLabel);
  }

  close() {
    const panel = document.getElementById("zotero-air-chat-panel");
    if (panel) {
      panel.remove();
    }
  }
}

export const aiChatPanel = new AIChatPanel();
