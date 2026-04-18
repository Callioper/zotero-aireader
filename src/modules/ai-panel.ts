import { config } from "../../package.json";
import { ALL_SKILLS, AISkill, SkillContext, ItemMetadata, extractQuotes } from "./skills";
import { findAndNavigateToText, createAnnotationsFromQuotes, parseQuotes } from "./annotation-manager";
import { ExtractedQuote } from "./skills/types";
import { isAutoHighlight, isAutoIndex, getSkillColor } from "../utils/prefs";
import { llmChat, llmHealthCheck, LLMMessage } from "./llm-client";
import { ragEngine } from "./rag-engine";

declare const rootURI: string;

/**
 * AI Panel - renders in the right-side item pane via Zotero.ItemPaneManager.registerSection()
 *
 * Layout:
 *   [Skill buttons bar]   - horizontal scrollable buttons for AI skills
 *   [Messages area]       - scrollable chat history
 *   [Input area]          - text input + send button
 */

// Per-item conversation state
interface ConversationState {
  messages: Array<{ role: "user" | "assistant" | "info" | "error"; content: string }>;
  indexed: boolean;
  fullText: string | null;
  metadata: ItemMetadata | null;
}

class AIPanel {
  private sectionID: string | false = false;
  private conversations: Map<number, ConversationState> = new Map();
  private currentItemId: number | null = null;
  private activeSkill: AISkill | null = null;
  /** Selected text from the PDF reader (set externally via setSelectedText) */
  private pendingSelectedText: string | null = null;

  /**
   * Register the AI panel as a custom section in the item pane.
   * Call this once during plugin startup.
   */
  register(): string | false {
    Zotero.debug("AI Reader: registering AI panel section");

    this.sectionID = Zotero.ItemPaneManager.registerSection({
      paneID: "zotero-ai-reader-panel",
      pluginID: config.addonID,
      header: {
        l10nID: "zotero-air-reader-panel-header",
        icon: `chrome://zoteroAIRreader/content/icons/icon16.svg`,
      },
      sidenav: {
        l10nID: "zotero-air-reader-panel-sidenav",
        icon: `chrome://zoteroAIRreader/content/icons/icon20.svg`,
      },

      onInit: ({ body }) => {
        Zotero.debug("AI Reader: panel section initialized");
        body.style.padding = "0";
      },

      onDestroy: () => {
        Zotero.debug("AI Reader: panel section destroyed");
      },

      onItemChange: ({ item, tabType, setEnabled }) => {
        // Enable the panel when in reader tab or when viewing an item with PDF attachments
        if (tabType === "reader") {
          setEnabled(true);
          return;
        }
        if (item && item.isRegularItem()) {
          const attachmentIDs = item.getAttachments();
          const hasPDF = attachmentIDs.some((id: number) => {
            const att = Zotero.Items.get(id);
            return att && att.isPDFAttachment();
          });
          setEnabled(hasPDF);
          return;
        }
        setEnabled(false);
      },

      onRender: ({ doc, body, item }) => {
        // Clear previous content
        body.replaceChildren();

        if (!item) {
          body.textContent = "No item selected";
          return;
        }

        const itemId = this.resolveItemId(item);
        this.currentItemId = itemId;

        // Extract and cache metadata
        this.cacheMetadata(itemId, item);

        // Build the panel UI
        this.buildUI(doc, body, itemId);
      },

      onAsyncRender: async ({ body, item }) => {
        if (!item) return;
        const itemId = this.resolveItemId(item);
        const conv = this.getConversation(itemId);

        // Auto-index the document on first view (if preference enabled)
        if (!conv.indexed && isAutoIndex()) {
          await this.indexDocument(itemId, item, body);
        }
        if (!conv.fullText) {
          await this.cacheFullText(itemId, item);
        }
      },

      onToggle: ({ body, item }) => {
        // Scroll messages to bottom when section is toggled open
        if (item) {
          const messagesEl = body.querySelector(".air-messages") as HTMLElement | null;
          if (messagesEl) {
            messagesEl.scrollTop = messagesEl.scrollHeight;
          }
        }
      },
    });

    Zotero.debug(`AI Reader: panel section registered, ID: ${this.sectionID}`);
    return this.sectionID;
  }

  /**
   * Unregister the panel section. Call during plugin shutdown.
   */
  unregister() {
    if (this.sectionID) {
      Zotero.ItemPaneManager.unregisterSection(this.sectionID);
      Zotero.debug("AI Reader: panel section unregistered");
      this.sectionID = false;
    }
    this.conversations.clear();
  }

  /**
   * Set selected text from the Reader's text selection popup.
   * Called externally by the text selection event handler in hooks.ts.
   */
  setSelectedText(text: string) {
    this.pendingSelectedText = text;
    Zotero.debug(`AI Reader: selected text set (${text.length} chars)`);
  }

  /**
   * Get the currently active item ID (for external coordination).
   */
  getCurrentItemId(): number | null {
    return this.currentItemId;
  }

  // ─── Item Resolution ──────────────────────────────────────

  /**
   * Resolve the effective item ID for conversation tracking.
   * If the item is an attachment, use its ID; if regular, find first PDF attachment.
   */
  private resolveItemId(item: any): number {
    if (item.isAttachment() && item.isPDFAttachment?.()) {
      return item.id;
    }
    if (item.isRegularItem()) {
      const attachmentIDs = item.getAttachments();
      for (const id of attachmentIDs) {
        const att = Zotero.Items.get(id);
        if (att && att.isPDFAttachment()) {
          return att.id;
        }
      }
    }
    return item.id;
  }

  private getConversation(itemId: number): ConversationState {
    if (!this.conversations.has(itemId)) {
      this.conversations.set(itemId, {
        messages: [],
        indexed: false,
        fullText: null,
        metadata: null,
      });
    }
    return this.conversations.get(itemId)!;
  }

  // ─── Metadata & Text Caching ──────────────────────────────

  private cacheMetadata(itemId: number, item: any) {
    const conv = this.getConversation(itemId);
    if (conv.metadata) return;

    try {
      // Navigate to the parent regular item if this is an attachment
      let regularItem = item;
      if (item.isAttachment()) {
        const parentId = item.parentID;
        if (parentId) {
          regularItem = Zotero.Items.get(parentId);
        }
      }

      const creators = regularItem.getCreators?.() || [];
      const creatorNames = creators.map((c: any) => {
        if (c.firstName && c.lastName) return `${c.firstName} ${c.lastName}`;
        return c.lastName || c.firstName || c.name || "";
      });

      conv.metadata = {
        title: regularItem.getField?.("title") || "",
        creators: creatorNames,
        date: regularItem.getField?.("date") || undefined,
        abstractNote: regularItem.getField?.("abstractNote") || undefined,
        itemType: regularItem.itemType || undefined,
      };
    } catch (e) {
      Zotero.debug("AI Reader: failed to extract metadata: " + e);
      conv.metadata = { title: "", creators: [] };
    }
  }

  private async cacheFullText(itemId: number, item: any) {
    const conv = this.getConversation(itemId);
    try {
      let attachment: any = null;

      if (item.isAttachment() && item.isPDFAttachment?.()) {
        attachment = item;
      } else if (item.isRegularItem()) {
        const attachmentIDs = item.getAttachments();
        for (const id of attachmentIDs) {
          const att = Zotero.Items.get(id);
          if (att && att.isPDFAttachment()) {
            attachment = att;
            break;
          }
        }
      }

      if (attachment) {
        const text = await attachment.attachmentText;
        conv.fullText = text || null;
        Zotero.debug(`AI Reader: cached full text for item ${itemId} (${text?.length || 0} chars)`);
      }
    } catch (e) {
      Zotero.debug("AI Reader: failed to get full text: " + e);
    }
  }

  // ─── UI Building ──────────────────────────────────────────

  private buildUI(doc: Document, body: HTMLElement, itemId: number) {
    const container = doc.createElement("div");
    container.className = "air-container";

    // l10n prefix for dynamic elements (scaffold prefixes all ftl IDs with addonRef)
    const l10nPrefix = config.addonRef;

    // Skill buttons bar
    const skillsBar = doc.createElement("div");
    skillsBar.className = "air-skills-bar";
    for (const skill of ALL_SKILLS) {
      const btn = doc.createElement("button");
      btn.className = "air-skill-btn";
      if (this.activeSkill?.id === skill.id) {
        btn.classList.add("air-skill-btn-active");
      }
      // Use l10n: set data-l10n-id with addonRef prefix for localized labels
      const iconSpan = doc.createElement("span");
      iconSpan.textContent = skill.icon + " ";
      btn.appendChild(iconSpan);
      const labelSpan = doc.createElement("span");
      labelSpan.dataset.l10nId = `${l10nPrefix}-${skill.nameKey}`;
      btn.appendChild(labelSpan);
      btn.title = skill.descriptionKey; // Fallback tooltip (l10n applied separately)
      btn.dataset.skillId = skill.id;
      btn.addEventListener("click", () => this.onSkillClick(skill, body, itemId));
      skillsBar.appendChild(btn);
    }
    container.appendChild(skillsBar);

    // Messages area
    const messages = doc.createElement("div");
    messages.className = "air-messages";

    // Restore existing conversation messages
    const conv = this.getConversation(itemId);
    for (const msg of conv.messages) {
      messages.appendChild(this.createMessageElement(doc, msg.role, msg.content));
    }
    container.appendChild(messages);

    // Input area
    const inputArea = doc.createElement("div");
    inputArea.className = "air-input-area";

    const textarea = doc.createElement("textarea");
    textarea.className = "air-input";
    textarea.placeholder = "输入问题，或点击上方技能按钮...";
    textarea.rows = 2;
    textarea.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.onSend(body, itemId);
      }
    });
    inputArea.appendChild(textarea);

    const sendBtn = doc.createElement("button");
    sendBtn.className = "air-send-btn";
    sendBtn.textContent = "发送";
    sendBtn.addEventListener("click", () => this.onSend(body, itemId));
    inputArea.appendChild(sendBtn);

    container.appendChild(inputArea);
    body.appendChild(container);

    // Scroll to bottom
    requestAnimationFrame(() => {
      messages.scrollTop = messages.scrollHeight;
    });
  }

  private createMessageElement(doc: Document, role: string, content: string): HTMLElement {
    const el = doc.createElement("div");
    el.className = `air-msg air-msg-${role}`;

    if (role === "user") {
      el.textContent = content;
    } else if (role === "assistant") {
      // Render with quote highlighting and locate buttons
      el.innerHTML = this.renderAssistantMessage(content);
      // Attach click handlers for quote locate buttons
      el.querySelectorAll(".air-quote-locate").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const quoteText = (e.target as HTMLElement).dataset.quote || "";
          this.onLocateQuote(quoteText);
        });
      });
    } else {
      // info, error
      el.textContent = content;
    }

    return el;
  }

  private renderAssistantMessage(text: string): string {
    // Escape HTML
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Markdown basics
    html = html
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/`(.*?)`/g, "<code>$1</code>");

    // Replace [[QUOTE: "..."]] with styled quote blocks + locate button
    html = html.replace(
      /\[\[QUOTE:\s*&quot;(.*?)&quot;\]\]/g,
      (_match, quoteText) => {
        const escaped = quoteText.replace(/"/g, "&quot;");
        return `<span class="air-quote-ref">${quoteText}</span><button class="air-quote-locate" data-quote="${escaped}" title="定位原文">📍</button>`;
      },
    );

    // Newlines to <br>
    html = html.replace(/\n/g, "<br>");

    return html;
  }

  // ─── Event Handlers ───────────────────────────────────────

  private async onSkillClick(skill: AISkill, body: HTMLElement, itemId: number) {
    this.activeSkill = skill;
    const conv = this.getConversation(itemId);
    const doc = body.ownerDocument;

    // Update button active states
    body.querySelectorAll(".air-skill-btn").forEach((btn) => {
      const el = btn as HTMLElement;
      if (el.dataset.skillId === skill.id) {
        el.classList.add("air-skill-btn-active");
      } else {
        el.classList.remove("air-skill-btn-active");
      }
    });

    // Build skill context
    const context = this.buildSkillContext(itemId);

    // Add a user message showing which skill was activated
    const userMsg = `[技能] ${skill.icon} ${skill.nameKey}`;
    conv.messages.push({ role: "user", content: userMsg });
    this.appendMessage(body, doc, "user", userMsg);

    // Build the full prompt using the skill
    const systemPrompt = skill.buildSystemPrompt(context);
    const userMessage = skill.buildUserMessage(context);

    // Clear the pending selected text after use
    this.pendingSelectedText = null;

    await this.sendToLLM(body, itemId, userMessage, doc, systemPrompt, skill);
  }

  private async onSend(body: HTMLElement, itemId: number) {
    const doc = body.ownerDocument;
    const textarea = body.querySelector(".air-input") as HTMLTextAreaElement | null;
    if (!textarea || !textarea.value.trim()) return;

    const question = textarea.value.trim();
    textarea.value = "";

    const conv = this.getConversation(itemId);
    conv.messages.push({ role: "user", content: question });
    this.appendMessage(body, doc, "user", question);

    // If a skill is active, use its prompt system
    let systemPrompt: string | undefined;
    let userMessage: string;

    if (this.activeSkill) {
      const context = this.buildSkillContext(itemId, question);
      systemPrompt = this.activeSkill.buildSystemPrompt(context);
      userMessage = this.activeSkill.buildUserMessage(context);
    } else {
      userMessage = question;
    }

    this.pendingSelectedText = null;
    await this.sendToLLM(body, itemId, userMessage, doc, systemPrompt, this.activeSkill);
  }

  private async onLocateQuote(quoteText: string) {
    if (!this.currentItemId) return;
    Zotero.debug(`AI Reader: locate quote: "${quoteText.substring(0, 50)}..."`);
    const found = await findAndNavigateToText(this.currentItemId, quoteText);
    if (!found) {
      Zotero.debug("AI Reader: could not navigate to quote in reader");
    }
  }

  // ─── Skill Context Building ───────────────────────────────

  private buildSkillContext(itemId: number, userQuery?: string): SkillContext {
    const conv = this.getConversation(itemId);
    return {
      fullText: conv.fullText || "",
      selectedText: this.pendingSelectedText || undefined,
      itemMetadata: conv.metadata || { title: "", creators: [] },
      userQuery,
    };
  }

  // ─── LLM Communication (built-in, no backend needed) ───────

  private async sendToLLM(
    body: HTMLElement,
    itemId: number,
    question: string,
    doc: Document,
    skillPrompt?: string,
    skill?: AISkill | null,
  ) {
    const conv = this.getConversation(itemId);

    // Show loading indicator
    const loadingMsg = "思考中...";
    conv.messages.push({ role: "info", content: loadingMsg });
    const loadingEl = this.appendMessage(body, doc, "info", loadingMsg);

    this.setInputEnabled(body, false);

    try {
      // Build RAG context from indexed document
      let ragContext = "";
      if (ragEngine.isIndexed(itemId)) {
        const results = await ragEngine.search(itemId, question, 5);
        ragContext = ragEngine.buildContext(results);
      }

      // Build LLM messages
      const messages: LLMMessage[] = [];

      // System prompt: skill-specific or default, with RAG context
      const systemContent = this.buildSystemMessage(skillPrompt, ragContext);
      messages.push({ role: "system", content: systemContent });

      // User message
      messages.push({ role: "user", content: question });

      // Call LLM directly
      const answer = await llmChat({ messages });

      // Remove loading message
      conv.messages.pop();
      loadingEl.remove();

      // Parse through skill if available
      let displayContent: string;
      if (skill) {
        const result = skill.parseResult(answer);
        displayContent = answer;
        if (result.quotes.length > 0) {
          displayContent += `\n\n_已提取 ${result.quotes.length} 条原文引用，可点击 📍 定位原文_`;
        }

        // Auto-create annotations from extracted quotes
        if (result.quotes.length > 0 && isAutoHighlight()) {
          this.createQuoteAnnotations(itemId, result.quotes, skill, body, doc);
        }
      } else {
        displayContent = answer;
      }

      conv.messages.push({ role: "assistant", content: displayContent });
      this.appendMessage(body, doc, "assistant", displayContent);
    } catch (error) {
      // Remove loading message
      conv.messages.pop();
      loadingEl.remove();

      const errMsg = `请求失败: ${error}`;
      conv.messages.push({ role: "error", content: errMsg });
      this.appendMessage(body, doc, "error", errMsg);
    } finally {
      this.setInputEnabled(body, true);
    }
  }

  private buildSystemMessage(skillPrompt?: string, ragContext?: string): string {
    const contextBlock = ragContext ? `\n\n${ragContext}` : "";

    if (skillPrompt) {
      return `${skillPrompt}${contextBlock}\n\n引用原文时使用 [[QUOTE: "原文"]] 格式标记。`;
    }

    return `你是一位 AI 阅读助手。请根据参考材料回答用户问题。${contextBlock}\n\n回答要求:\n1. 基于参考材料回答\n2. 准确简洁\n3. 引用原文时使用 [[QUOTE: "原文"]] 格式标记\n4. 材料不足时说明无法回答`;
  }

  /**
   * Create Zotero annotations from extracted quotes (runs in background).
   */
  private async createQuoteAnnotations(
    itemId: number,
    quotes: ExtractedQuote[],
    skill: AISkill,
    body: HTMLElement,
    doc: Document,
  ) {
    try {
      // Use color from preferences (user-customizable) with fallback to skill default
      const color = getSkillColor(skill.id) || skill.color;

      const results = await createAnnotationsFromQuotes(
        itemId,
        quotes,
        color,
        skill.nameKey,
      );
      const successCount = results.filter((r) => r.success).length;
      if (successCount > 0) {
        const highlightCount = results.filter((r) => r.type === "highlight" && r.success).length;
        const noteCount = results.filter((r) => r.type === "note" && r.success).length;
        const msg = `已创建 ${successCount} 条标注（${highlightCount} 高亮 / ${noteCount} 笔记）`;
        this.appendMessage(body, doc, "info", msg);
      }
    } catch (e) {
      Zotero.debug("AI Reader: annotation creation failed: " + e);
    }
  }

  // ─── DOM Helpers ──────────────────────────────────────────

  private appendMessage(body: HTMLElement, doc: Document, role: string, content: string): HTMLElement {
    const messagesEl = body.querySelector(".air-messages");
    if (!messagesEl) {
      Zotero.debug("AI Reader: messages container not found");
      return doc.createElement("div");
    }
    const el = this.createMessageElement(doc, role, content);
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return el;
  }

  private setInputEnabled(body: HTMLElement, enabled: boolean) {
    const textarea = body.querySelector(".air-input") as HTMLTextAreaElement | null;
    const sendBtn = body.querySelector(".air-send-btn") as HTMLButtonElement | null;
    const skillBtns = body.querySelectorAll(".air-skill-btn");

    if (textarea) textarea.disabled = !enabled;
    if (sendBtn) sendBtn.disabled = !enabled;
    skillBtns.forEach((btn) => ((btn as HTMLButtonElement).disabled = !enabled));
  }

  // ─── Indexing ─────────────────────────────────────────────

  private async indexDocument(itemId: number, item: any, body: HTMLElement) {
    const conv = this.getConversation(itemId);
    const doc = body.ownerDocument;

    try {
      // Get full text from PDF for built-in RAG
      if (!conv.fullText) {
        await this.cacheFullText(itemId, item);
      }

      if (!conv.fullText) {
        this.appendMessage(body, doc, "error", "无法获取 PDF 文本内容");
        return;
      }

      this.appendMessage(body, doc, "info", "正在建立索引（分块 + 向量化）...");

      // Index using built-in RAG engine
      await ragEngine.indexDocument(itemId, conv.fullText);
      conv.indexed = true;

      const successMsg = "索引建立完成，可以开始提问了。";
      conv.messages.push({ role: "info", content: successMsg });
      this.appendMessage(body, doc, "info", successMsg);
    } catch (error) {
      // If embedding fails, RAG falls back to keyword search
      // Mark as indexed anyway so the user can still chat
      conv.indexed = true;
      const warnMsg = `索引部分完成（将使用关键词搜索）: ${error}`;
      conv.messages.push({ role: "info", content: warnMsg });
      this.appendMessage(body, doc, "info", warnMsg);
    }
  }

}

export const aiPanel = new AIPanel();
