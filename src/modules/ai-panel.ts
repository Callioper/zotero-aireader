import { config } from "../../package.json";
import { ALL_SKILLS, AISkill, SkillContext, ItemMetadata } from "./skills";
import { findAndNavigateToText, createAnnotationsFromQuotes } from "./annotation-manager";
import { ExtractedQuote } from "./skills/types";
import { isAutoHighlight, isAutoIndex, getSkillColor, isEmbeddingEnabled } from "../utils/prefs";
import { llmChat, LLMMessage, isChatConfigured } from "./llm-client";
import { ragEngine } from "./rag-engine";
import { truncateText } from "./pdf-text";

declare const rootURI: string;

/**
 * AI Panel - renders in the right-side item pane via Zotero.ItemPaneManager.registerSection()
 *
 * Layout (when configured):
 *   [Skill buttons bar]   - horizontal scrollable buttons for AI skills
 *   [Messages area]       - scrollable chat history
 *   [Input area]          - text input + send button
 *
 * Layout (when NOT configured):
 *   [Setup guide]         - welcome message + "Open Settings" button
 */

// ─── Constants ──────────────────────────────────────────────

/** Max chars of full text to include directly in prompt (no RAG) */
const MAX_CONTEXT_CHARS = 8000;

// Per-item conversation state
interface ConversationState {
  messages: Array<{ role: "user" | "assistant" | "info" | "error"; content: string }>;
  indexed: boolean;
  indexing: boolean; // true while async indexing is in progress
  fullText: string | null;
  metadata: ItemMetadata | null;
}

class AIPanel {
  private sectionID: string | false = false;
  private conversations: Map<number, ConversationState> = new Map();
  private currentItemId: number | null = null;
  private activeSkill: AISkill | null = null;
  private pendingSelectedText: string | null = null;

  /**
   * Register the AI panel as a custom section in the item pane.
   */
  register(): string | false {
    Zotero.debug("AI Reader: registering AI panel section");

    this.sectionID = Zotero.ItemPaneManager.registerSection({
      paneID: "zotero-ai-reader-panel",
      pluginID: config.addonID,
      header: {
        l10nID: `${config.addonRef}-zotero-air-reader-panel-header`,
        icon: `chrome://zoteroAIRreader/content/icons/icon16.svg`,
      },
      sidenav: {
        l10nID: `${config.addonRef}-zotero-air-reader-panel-sidenav`,
        icon: `chrome://zoteroAIRreader/content/icons/icon20.svg`,
      },

      onInit: ({ body }) => {
        body.style.padding = "0";
      },

      onDestroy: () => {
        Zotero.debug("AI Reader: panel section destroyed");
      },

      onItemChange: ({ item, tabType, setEnabled }) => {
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
        body.replaceChildren();

        if (!item) {
          body.textContent = "No item selected";
          return;
        }

        const itemId = this.resolveItemId(item);
        this.currentItemId = itemId;
        this.cacheMetadata(itemId, item);

        // Check if chat is configured — if not, show setup guide
        if (!isChatConfigured()) {
          this.buildSetupUI(doc, body);
          return;
        }

        this.buildUI(doc, body, itemId);
      },

      onAsyncRender: async ({ body, item }) => {
        if (!item) return;
        const itemId = this.resolveItemId(item);

        // Only cache full text — NO automatic API calls
        await this.cacheFullText(itemId, item);

        // Auto-indexing: only if auto mode AND embedding enabled AND not yet indexed
        if (isAutoIndex() && !this.getConversation(itemId).indexed) {
          const conv = this.getConversation(itemId);
          if (conv.fullText && !conv.indexing) {
            conv.indexing = true;
            ragEngine.indexDocumentAsync(itemId, conv.fullText);
          }
        }
      },

      onToggle: ({ body, item }) => {
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

  unregister() {
    if (this.sectionID) {
      Zotero.ItemPaneManager.unregisterSection(this.sectionID);
      this.sectionID = false;
    }
    this.conversations.clear();
  }

  setSelectedText(text: string) {
    this.pendingSelectedText = text;
  }

  getCurrentItemId(): number | null {
    return this.currentItemId;
  }

  // ─── Item Resolution ──────────────────────────────────────

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
        indexing: false,
        fullText: null,
        metadata: null,
      });
    }
    return this.conversations.get(itemId)!;
  }

  // ─── Metadata & Text Caching (no API calls) ──────────────

  private cacheMetadata(itemId: number, item: any) {
    const conv = this.getConversation(itemId);
    if (conv.metadata) return;

    try {
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
    if (conv.fullText) return;

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

  // ─── Setup Guide UI (shown when not configured) ──────────

  private buildSetupUI(doc: Document, body: HTMLElement) {
    const container = doc.createElement("div");
    container.className = "air-container";
    container.style.cssText = "display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px 16px; text-align: center; min-height: 200px;";

    const icon = doc.createElement("div");
    icon.textContent = "\u{1F916}";
    icon.style.cssText = "font-size: 36px; margin-bottom: 12px;";
    container.appendChild(icon);

    const title = doc.createElement("div");
    title.style.cssText = "font-size: 15px; font-weight: 600; margin-bottom: 12px;";
    title.dataset.l10nId = `${config.addonRef}-setup-welcome`;
    container.appendChild(title);

    const steps = doc.createElement("div");
    steps.style.cssText = "font-size: 13px; color: #666; margin-bottom: 16px; text-align: left;";

    const step1 = doc.createElement("div");
    step1.style.marginBottom = "4px";
    step1.textContent = "1. ";
    const step1Text = doc.createElement("span");
    step1Text.dataset.l10nId = `${config.addonRef}-setup-step1`;
    step1.appendChild(step1Text);
    steps.appendChild(step1);

    const step2 = doc.createElement("div");
    step2.textContent = "2. ";
    const step2Text = doc.createElement("span");
    step2Text.dataset.l10nId = `${config.addonRef}-setup-step2`;
    step2.appendChild(step2Text);
    steps.appendChild(step2);

    container.appendChild(steps);

    const btn = doc.createElement("button");
    btn.style.cssText = "padding: 8px 20px; border-radius: 6px; border: 1px solid #ccc; background: #0078d7; color: white; cursor: pointer; font-size: 13px;";
    btn.dataset.l10nId = `${config.addonRef}-setup-open-settings`;
    btn.addEventListener("click", () => {
      try {
        // Zotero 7+: openPreferences accepts paneID to jump to
        const mainWin = Zotero.getMainWindow();
        if (mainWin?.openDialog) {
          mainWin.openDialog(
            "chrome://zotero/content/preferences/preferences.xhtml",
            "zotero-prefs",
            "chrome,titlebar,toolbar,centerscreen",
            { pane: config.addonID },
          );
        }
      } catch (e) {
        Zotero.debug("AI Reader: failed to open preferences: " + e);
      }
    });
    container.appendChild(btn);

    body.appendChild(container);
  }

  // ─── Main Chat UI ─────────────────────────────────────────

  private buildUI(doc: Document, body: HTMLElement, itemId: number) {
    const container = doc.createElement("div");
    container.className = "air-container";

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
      const iconSpan = doc.createElement("span");
      iconSpan.textContent = skill.icon + " ";
      btn.appendChild(iconSpan);
      const labelSpan = doc.createElement("span");
      labelSpan.dataset.l10nId = `${l10nPrefix}-${skill.nameKey}`;
      btn.appendChild(labelSpan);
      btn.title = skill.descriptionKey;
      btn.dataset.skillId = skill.id;
      btn.addEventListener("click", () => this.onSkillClick(skill, body, itemId));
      skillsBar.appendChild(btn);
    }
    container.appendChild(skillsBar);

    // Indexing status bar (shown when embedding is enabled)
    const indexingBar = doc.createElement("div");
    indexingBar.className = "air-indexing-bar";
    indexingBar.style.cssText = "display: flex; align-items: center; gap: 8px; padding: 6px 12px; background: #f5f5f5; border-bottom: 1px solid #e0e0e0; font-size: 12px;";

    const indexStatus = doc.createElement("span");
    indexStatus.className = "air-index-status";
    indexStatus.style.cssText = "flex: 1; color: #666;";

    const indexBtn = doc.createElement("button");
    indexBtn.className = "air-index-btn";
    indexBtn.style.cssText = "padding: 4px 12px; border-radius: 4px; border: 1px solid #0078d7; background: #0078d7; color: white; cursor: pointer; font-size: 11px;";
    indexBtn.textContent = "Index";

    const progressBar = doc.createElement("div");
    progressBar.className = "air-index-progress";
    progressBar.style.cssText = "width: 60px; height: 6px; background: #e0e0e0; border-radius: 3px; display: none;";
    const progressFill = doc.createElement("div");
    progressFill.style.cssText = "height: 100%; background: #0078d7; border-radius: 3px; width: 0%;";
    progressBar.appendChild(progressFill);
    progressBar.style.display = "none";

    indexingBar.appendChild(indexStatus);
    indexingBar.appendChild(progressBar);
    indexingBar.appendChild(indexBtn);
    container.appendChild(indexingBar);

    // Update index status based on current state
    const conv = this.getConversation(itemId);
    this.updateIndexStatus(conv, itemId, indexStatus, indexBtn, progressBar, progressFill, indexingBar);

    // Index button click handler
    indexBtn.addEventListener("click", () => {
      if (conv.fullText && !conv.indexing && !conv.indexed) {
        conv.indexing = true;
        indexBtn.style.display = "none";
        progressBar.style.display = "block";
        progressFill.style.width = "0%";
        indexStatus.textContent = "Indexing...";

        ragEngine.indexDocumentWithProgress(itemId, conv.fullText, (percent, status) => {
          indexStatus.textContent = status;
          progressFill.style.width = percent + "%";
        }).then(() => {
          conv.indexed = true;
          conv.indexing = false;
          indexStatus.textContent = "Indexed";
          indexStatus.style.color = "#4CAF50";
          progressBar.style.display = "none";
          indexBtn.textContent = "Re-index";
          indexBtn.style.display = "inline-block";
        }).catch((e) => {
          conv.indexing = false;
          indexStatus.textContent = "Index failed";
          indexStatus.style.color = "#f44336";
          progressBar.style.display = "none";
          indexBtn.style.display = "inline-block";
        });
      }
    });

    // Messages area
    const messages = doc.createElement("div");
    messages.className = "air-messages";

    for (const msg of conv.messages) {
      messages.appendChild(this.createMessageElement(doc, msg.role, msg.content));
    }
    container.appendChild(messages);

    // Input area
    const inputArea = doc.createElement("div");
    inputArea.className = "air-input-area";

    const textarea = doc.createElement("textarea");
    textarea.className = "air-input";
    textarea.placeholder = "\u8f93\u5165\u95ee\u9898\uff0c\u6216\u70b9\u51fb\u4e0a\u65b9\u6280\u80fd\u6309\u94ae...";
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
    sendBtn.textContent = "\u53d1\u9001";
    sendBtn.addEventListener("click", () => this.onSend(body, itemId));
    inputArea.appendChild(sendBtn);

    container.appendChild(inputArea);
    body.appendChild(container);

    // Use setTimeout instead of requestAnimationFrame (not available in Zotero privileged context)
    setTimeout(() => {
      messages.scrollTop = messages.scrollHeight;
    }, 0);
  }

  private createMessageElement(doc: Document, role: string, content: string): HTMLElement {
    const el = doc.createElement("div");
    el.className = `air-msg air-msg-${role}`;

    if (role === "user") {
      el.textContent = content;
    } else if (role === "assistant") {
      el.innerHTML = this.renderAssistantMessage(content);
      el.querySelectorAll(".air-quote-locate").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const quoteText = (e.target as HTMLElement).dataset.quote || "";
          this.onLocateQuote(quoteText);
        });
      });
    } else {
      el.textContent = content;
    }

    return el;
  }

  private renderAssistantMessage(text: string): string {
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    html = html
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/`(.*?)`/g, "<code>$1</code>");

    html = html.replace(
      /\[\[QUOTE:\s*&quot;(.*?)&quot;\]\]/g,
      (_match, quoteText) => {
        const escaped = quoteText.replace(/"/g, "&quot;");
        return `<span class="air-quote-ref">${quoteText}</span><button class="air-quote-locate" data-quote="${escaped}" title="\u5b9a\u4f4d\u539f\u6587">\u{1F4CD}</button>`;
      },
    );

    html = html.replace(/\n/g, "<br>");
    return html;
  }

  // ─── Event Handlers ───────────────────────────────────────

  private async onSkillClick(skill: AISkill, body: HTMLElement, itemId: number) {
    this.activeSkill = skill;
    const conv = this.getConversation(itemId);
    const doc = body.ownerDocument;

    body.querySelectorAll(".air-skill-btn").forEach((btn) => {
      const el = btn as HTMLElement;
      if (el.dataset.skillId === skill.id) {
        el.classList.add("air-skill-btn-active");
      } else {
        el.classList.remove("air-skill-btn-active");
      }
    });

    const context = this.buildSkillContext(itemId);
    const userMsg = `[\u6280\u80fd] ${skill.icon} ${skill.nameKey}`;
    conv.messages.push({ role: "user", content: userMsg });
    this.appendMessage(body, doc, "user", userMsg);

    const systemPrompt = skill.buildSystemPrompt(context);
    const userMessage = skill.buildUserMessage(context);
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
    await findAndNavigateToText(this.currentItemId, quoteText);
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

  // ─── LLM Communication ────────────────────────────────────

  private async sendToLLM(
    body: HTMLElement,
    itemId: number,
    question: string,
    doc: Document,
    skillPrompt?: string,
    skill?: AISkill | null,
  ) {
    const conv = this.getConversation(itemId);

    const loadingMsg = "\u601d\u8003\u4e2d...";
    conv.messages.push({ role: "info", content: loadingMsg });
    const loadingEl = this.appendMessage(body, doc, "info", loadingMsg);

    this.setInputEnabled(body, false);

    try {
      // Build context: RAG if available, otherwise truncated full text
      let contextBlock = "";

      if (isEmbeddingEnabled() && ragEngine.isIndexed(itemId)) {
        // Use RAG search
        try {
          const results = await ragEngine.search(itemId, question, 5);
          contextBlock = ragEngine.buildContext(results);
        } catch (e) {
          Zotero.debug("AI Reader: RAG search failed, using full text fallback: " + e);
        }
      }

      // Fallback: truncated full text as context
      if (!contextBlock && conv.fullText) {
        contextBlock = "\u53c2\u8003\u6750\u6599:\n" + truncateText(conv.fullText, MAX_CONTEXT_CHARS);
      }

      // Trigger async indexing in background if embedding enabled but not yet indexed
      if (isEmbeddingEnabled() && !conv.indexed && !conv.indexing && conv.fullText) {
        conv.indexing = true;
        ragEngine.indexDocumentAsync(itemId, conv.fullText);
      }

      // Build LLM messages
      const messages: LLMMessage[] = [];
      const systemContent = this.buildSystemMessage(skillPrompt, contextBlock);
      messages.push({ role: "system", content: systemContent });
      messages.push({ role: "user", content: question });

      const answer = await llmChat({ messages });

      // Remove loading message
      conv.messages.pop();
      loadingEl.remove();

      let displayContent: string;
      if (skill) {
        const result = skill.parseResult(answer);
        displayContent = answer;
        if (result.quotes.length > 0) {
          displayContent += `\n\n_\u5df2\u63d0\u53d6 ${result.quotes.length} \u6761\u539f\u6587\u5f15\u7528\uff0c\u53ef\u70b9\u51fb \u{1F4CD} \u5b9a\u4f4d\u539f\u6587_`;
        }

        if (result.quotes.length > 0 && isAutoHighlight()) {
          this.createQuoteAnnotations(itemId, result.quotes, skill, body, doc);
        }
      } else {
        displayContent = answer;
      }

      conv.messages.push({ role: "assistant", content: displayContent });
      this.appendMessage(body, doc, "assistant", displayContent);
    } catch (error) {
      conv.messages.pop();
      loadingEl.remove();

      const errMsg = `\u8bf7\u6c42\u5931\u8d25: ${error}`;
      conv.messages.push({ role: "error", content: errMsg });
      this.appendMessage(body, doc, "error", errMsg);
    } finally {
      this.setInputEnabled(body, true);
    }
  }

  private buildSystemMessage(skillPrompt?: string, contextBlock?: string): string {
    const ctx = contextBlock ? `\n\n${contextBlock}` : "";

    if (skillPrompt) {
      return `${skillPrompt}${ctx}\n\n\u5f15\u7528\u539f\u6587\u65f6\u4f7f\u7528 [[QUOTE: "\u539f\u6587"]] \u683c\u5f0f\u6807\u8bb0\u3002`;
    }

    return `\u4f60\u662f\u4e00\u4f4d AI \u9605\u8bfb\u52a9\u624b\u3002\u8bf7\u6839\u636e\u53c2\u8003\u6750\u6599\u56de\u7b54\u7528\u6237\u95ee\u9898\u3002${ctx}\n\n\u56de\u7b54\u8981\u6c42:\n1. \u57fa\u4e8e\u53c2\u8003\u6750\u6599\u56de\u7b54\n2. \u51c6\u786e\u7b80\u6d01\n3. \u5f15\u7528\u539f\u6587\u65f6\u4f7f\u7528 [[QUOTE: "\u539f\u6587"]] \u683c\u5f0f\u6807\u8bb0\n4. \u6750\u6599\u4e0d\u8db3\u65f6\u8bf4\u660e\u65e0\u6cd5\u56de\u7b54`;
  }

  private async createQuoteAnnotations(
    itemId: number,
    quotes: ExtractedQuote[],
    skill: AISkill,
    body: HTMLElement,
    doc: Document,
  ) {
    try {
      const color = getSkillColor(skill.id) || skill.color;
      const results = await createAnnotationsFromQuotes(itemId, quotes, color, skill.nameKey);
      const successCount = results.filter((r) => r.success).length;
      if (successCount > 0) {
        const highlightCount = results.filter((r) => r.type === "highlight" && r.success).length;
        const noteCount = results.filter((r) => r.type === "note" && r.success).length;
        const msg = `\u5df2\u521b\u5efa ${successCount} \u6761\u6807\u6ce8\uff08${highlightCount} \u9ad8\u4eae / ${noteCount} \u7b14\u8bb0\uff09`;
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

  private updateIndexStatus(
    conv: ConversationState,
    itemId: number,
    statusEl: HTMLSpanElement,
    btnEl: HTMLButtonElement,
    progressBar: HTMLDivElement,
    progressFill: HTMLDivElement,
    barEl: HTMLDivElement
  ) {
    // Hide the entire bar if embedding is not enabled
    if (!isEmbeddingEnabled()) {
      barEl.style.display = "none";
      return;
    }

    barEl.style.display = "flex";

    if (conv.indexed) {
      statusEl.textContent = "Indexed";
      statusEl.style.color = "#4CAF50";
      btnEl.textContent = "Re-index";
      btnEl.style.display = "inline-block";
      btnEl.style.background = "#f5f5f5";
      btnEl.style.color = "#0078d7";
      progressBar.style.display = "none";
    } else if (conv.indexing) {
      statusEl.textContent = "Indexing...";
      statusEl.style.color = "#ff9800";
      btnEl.style.display = "none";
      progressBar.style.display = "block";
    } else {
      // Check if already indexed in rag engine
      if (ragEngine.isIndexed(itemId)) {
        statusEl.textContent = "Indexed";
        statusEl.style.color = "#4CAF50";
        btnEl.textContent = "Re-index";
        btnEl.style.display = "inline-block";
        btnEl.style.background = "#f5f5f5";
        btnEl.style.color = "#0078d7";
        progressBar.style.display = "none";
      } else {
        statusEl.textContent = "Not indexed";
        statusEl.style.color = "#999";
        btnEl.textContent = "Index";
        btnEl.style.display = "inline-block";
        btnEl.style.background = "#0078d7";
        btnEl.style.color = "white";
        progressBar.style.display = "none";
      }
    }
  }
}

export const aiPanel = new AIPanel();