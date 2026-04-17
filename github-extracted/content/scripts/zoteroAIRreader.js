"use strict";
var _globalThis = (() => {
  // package.json
  var config = {
    addonName: "Zotero AI Reader",
    addonID: "zotero-ai-reader@yourname",
    addonRef: "zoteroAIRreader",
    addonInstance: "ZoteroAIRreader",
    prefsPrefix: "extensions.zotero-zoteroAIRreader"
  };

  // src/modules/api-client.ts
  var DEFAULT_API_BASE = "http://127.0.0.1:8765/api";
  function getApiBase() {
    try {
      const prefKey = "extensions.zotero-zoteroAIRreader.apiUrl";
      const url = Zotero.Prefs.get(prefKey, true);
      return url || DEFAULT_API_BASE;
    } catch {
      return DEFAULT_API_BASE;
    }
  }
  var APIClient = class {
    getBaseUrl() {
      return getApiBase();
    }
    async handleResponse(response) {
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API error ${response.status}: ${error || response.statusText}`);
      }
      return response.json();
    }
    async indexItem(itemId, pdfPath) {
      const response = await fetch(`${this.getBaseUrl()}/index`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId, pdf_path: pdfPath })
      });
      return this.handleResponse(response);
    }
    async chat(request) {
      const response = await fetch(`${this.getBaseUrl()}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request)
      });
      return this.handleResponse(response);
    }
    async search(q, itemId, limit) {
      const params = new URLSearchParams({ q });
      if (itemId !== void 0) params.append("item_id", String(itemId));
      if (limit !== void 0) params.append("limit", String(limit));
      const response = await fetch(`${this.getBaseUrl()}/search?${params}`);
      return this.handleResponse(response);
    }
    async health() {
      const base = this.getBaseUrl();
      const healthUrl = base.replace("/api", "") + "/health";
      const response = await fetch(healthUrl);
      return this.handleResponse(response);
    }
  };
  var apiClient = new APIClient();

  // src/modules/ai-chat.ts
  var AIChatPanel = class {
    panel = null;
    itemId = null;
    pdfPath = null;
    createPanel() {
      const vbox = document.createElement("vbox");
      vbox.setAttribute("flex", "1");
      const title = document.createElement("label");
      title.setAttribute("value", "AI \u95EE\u7B54");
      title.setAttribute("style", "font-weight: bold; font-size: 16px;");
      vbox.appendChild(title);
      const messages = document.createElement("vbox");
      messages.setAttribute("flex", "1");
      messages.setAttribute("style", "overflow: auto;");
      messages.setAttribute("id", "chat-messages");
      vbox.appendChild(messages);
      const inputBox = document.createElement("hbox");
      inputBox.setAttribute("align", "center");
      const input = document.createElement("textbox");
      input.setAttribute("flex", "1");
      input.setAttribute("placeholder", "\u8F93\u5165\u60A8\u7684\u95EE\u9898...");
      input.setAttribute("id", "chat-input");
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          this.sendQuestion();
        }
      });
      inputBox.appendChild(input);
      const button = document.createElement("button");
      button.setAttribute("label", "\u53D1\u9001");
      button.addEventListener("click", () => this.sendQuestion());
      inputBox.appendChild(button);
      vbox.appendChild(inputBox);
      return vbox;
    }
    open(itemId, pdfPath) {
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
    setInputEnabled(enabled) {
      const input = document.getElementById("chat-input");
      const buttons = document.querySelectorAll("#chat-input + button");
      if (input) input.disabled = !enabled;
      buttons.forEach((btn) => btn.disabled = !enabled);
    }
    async indexDocument() {
      if (!this.itemId || !this.pdfPath) return;
      this.setInputEnabled(false);
      try {
        const health = await apiClient.health();
        if (health.status !== "ok") {
          this.showMessage("Backend service is not running. Please start the service.", "error");
          return;
        }
        this.showMessage("\u6B63\u5728\u5EFA\u7ACB\u7D22\u5F15...", "info");
        await apiClient.indexItem(this.itemId, this.pdfPath);
        this.showMessage("\u7D22\u5F15\u5EFA\u7ACB\u5B8C\u6210\uFF0C\u53EF\u4EE5\u5F00\u59CB\u63D0\u95EE\u4E86\u3002", "success");
      } catch (error) {
        this.showMessage(`\u7D22\u5F15\u5931\u8D25: ${error}`, "error");
      } finally {
        this.setInputEnabled(true);
      }
    }
    async sendQuestion() {
      const input = document.getElementById("chat-input");
      if (!input || !input.value.trim()) return;
      const question = input.value.trim();
      input.value = "";
      this.showMessage(`\u95EE\u9898: ${question}`, "user");
      if (!this.itemId) return;
      this.setInputEnabled(false);
      try {
        this.showMessage("\u601D\u8003\u4E2D...", "info");
        const response = await apiClient.chat({
          item_id: this.itemId,
          question,
          use_rag: true
        });
        this.displayResponse(response);
      } catch (error) {
        this.showMessage(`\u56DE\u7B54\u5931\u8D25: ${error}`, "error");
      } finally {
        this.setInputEnabled(true);
      }
    }
    displayResponse(response) {
      const messagesContainer = document.getElementById("chat-messages");
      if (!messagesContainer) return;
      const answerBox = document.createElement("vbox");
      answerBox.setAttribute("style", "margin: 10px 0; padding: 10px; background: #f5f5f5; border-radius: 5px;");
      const answerLabel = document.createElement("label");
      answerLabel.setAttribute("value", `AI \u56DE\u7B54: ${response.answer}`);
      answerLabel.setAttribute("style", "color: #333;");
      answerBox.appendChild(answerLabel);
      if (response.citations.length > 0) {
        const citationsLabel = document.createElement("label");
        citationsLabel.setAttribute("value", "\u53C2\u8003\u6765\u6E90:");
        citationsLabel.setAttribute("style", "font-weight: bold; margin-top: 5px;");
        answerBox.appendChild(citationsLabel);
        response.citations.forEach((c) => {
          const citationText = `\u3010${c.index}\u3011${c.chapter_title}: ${c.quoted_text}`;
          const citationLabel = document.createElement("label");
          citationLabel.setAttribute("value", citationText);
          citationLabel.setAttribute("style", "font-size: 12px; color: #666; margin-left: 10px;");
          answerBox.appendChild(citationLabel);
        });
      }
      messagesContainer.appendChild(answerBox);
    }
    showMessage(text, type) {
      const messagesContainer = document.getElementById("chat-messages");
      if (!messagesContainer) return;
      const colors = {
        user: "#0078d7",
        info: "#666",
        error: "#d32f2f",
        success: "#388e3c"
      };
      const msgLabel = document.createElement("label");
      msgLabel.setAttribute("value", text);
      msgLabel.setAttribute("style", `color: ${colors[type] || colors.info}; margin: 5px 0;`);
      messagesContainer.appendChild(msgLabel);
    }
    close() {
      const panel = document.getElementById("zotero-air-chat-panel");
      if (panel) {
        panel.remove();
      }
    }
  };
  var aiChatPanel = new AIChatPanel();

  // src/hooks.ts
  async function onStartup() {
    await Zotero.initializationPromise;
    await Zotero.unlockPromise;
    await Zotero.uiReadyPromise;
    Zotero.debug("AI Reader: onStartup called");
    registerNotifier();
    registerPrefs();
  }
  function onShutdown() {
    Zotero.debug("AI Reader: onShutdown called");
    aiChatPanel.close();
    delete Zotero[config.addonInstance];
  }
  async function onMainWindowLoad(win) {
    Zotero.debug("AI Reader: onMainWindowLoad called");
    await new Promise((resolve) => {
      if (win.document.readyState !== "complete") {
        win.document.addEventListener("readystatechange", () => {
          if (win.document.readyState === "complete") {
            resolve(void 0);
          }
        });
      } else {
        resolve(void 0);
      }
    });
    await Zotero.uiReadyPromise;
    registerMenu(win);
  }
  function onMainWindowUnload(win) {
    Zotero.debug("AI Reader: onMainWindowUnload called");
  }
  function registerNotifier() {
    Zotero.Notifier.registerObserver(
      {
        notify: (event, type, ids, extraData) => {
          Zotero.debug("AI Reader: notified", event, type, ids);
        }
      },
      ["item"],
      "zotero-ai-reader"
    );
  }
  function registerPrefs() {
    Zotero.debug("AI Reader: registerPrefs called");
    try {
      const prefs = {
        id: config.addonID,
        label: "AI Reader",
        icon: rootURI + "content/icons/favicon.png",
        onload: () => {
          Zotero.debug("AI Reader: prefs pane loaded");
        }
      };
      Zotero.Prefs.registerObserver(prefs);
      Zotero.debug("AI Reader: PrefsPane add called");
    } catch (e) {
      Zotero.debug("AI Reader ERROR in registerPrefs: " + e);
    }
  }
  function registerMenu(win) {
    const menuPopup = win.document.getElementById("item-context-menu");
    if (!menuPopup) {
      Zotero.debug("AI Reader ERROR: item-context-menu not found");
      return;
    }
    Zotero.debug("AI Reader: found item-context-menu");
    const submenu = win.document.createElement("menu");
    submenu.setAttribute("id", "zotero-air-reader-menu");
    submenu.setAttribute("label", "AI Reader");
    const menupopup = win.document.createElement("menupopup");
    const menuItems = [
      { label: "AI \u95EE\u7B54", command: () => onAIChat() },
      { label: "\u603B\u7ED3\u6587\u732E", command: () => onSummarize() },
      { label: "\u8BED\u4E49\u641C\u7D22", command: () => onSearch() }
    ];
    for (const item of menuItems) {
      const menuitem = win.document.createElement("menuitem");
      menuitem.setAttribute("label", item.label);
      menuitem.addEventListener("command", item.command);
      menupopup.appendChild(menuitem);
    }
    submenu.appendChild(menupopup);
    menuPopup.appendChild(submenu);
    Zotero.debug("AI Reader: menu items added");
  }
  function alert(win, title, msg) {
    const prom = new win.XULDialog({
      buttons: [{ label: "OK", focus: true }],
      title,
      message: msg
    });
    prom.show();
  }
  async function onAIChat() {
    const items = ZoteroPane.getSelectedItems();
    if (!items.length) {
      alert(window, "\u63D0\u793A", "\u8BF7\u5148\u9009\u62E9\u4E00\u4E2A\u6587\u732E\u6761\u76EE");
      return;
    }
    const item = items[0];
    const attachments = item.attachments;
    if (!attachments || attachments.length === 0) {
      alert(window, "\u63D0\u793A", "\u8BF7\u9009\u62E9\u4E00\u4E2A\u5305\u542B PDF \u9644\u4EF6\u7684\u6587\u732E\u6761\u76EE");
      return;
    }
    const attachment = attachments[0];
    const pdfPath = attachment.filePath;
    if (!pdfPath) {
      alert(window, "\u63D0\u793A", "\u65E0\u6CD5\u83B7\u53D6 PDF \u6587\u4EF6\u8DEF\u5F84");
      return;
    }
    aiChatPanel.open(item.id, pdfPath);
  }
  async function onSummarize() {
    const items = ZoteroPane.getSelectedItems();
    if (!items.length) {
      alert(window, "\u63D0\u793A", "\u8BF7\u5148\u9009\u62E9\u4E00\u4E2A\u6587\u732E\u6761\u76EE");
      return;
    }
    const item = items[0];
    const attachments = item.attachments;
    if (!attachments || attachments.length === 0) {
      alert(window, "\u63D0\u793A", "\u8BF7\u9009\u62E9\u4E00\u4E2A\u5305\u542B PDF \u9644\u4EF6\u7684\u6587\u732E\u6761\u76EE");
      return;
    }
    const attachment = attachments[0];
    const pdfPath = attachment.filePath;
    if (!pdfPath) {
      alert(window, "\u63D0\u793A", "\u65E0\u6CD5\u83B7\u53D6 PDF \u6587\u4EF6\u8DEF\u5F84");
      return;
    }
    try {
      const health = await apiClient.health();
      if (health.status !== "ok") {
        alert(window, "\u63D0\u793A", "\u540E\u7AEF\u670D\u52A1\u672A\u8FD0\u884C\uFF0C\u8BF7\u5148\u542F\u52A8\u670D\u52A1");
        return;
      }
      alert(window, "\u63D0\u793A", "\u6B63\u5728\u751F\u6210\u603B\u7ED3\uFF0C\u8BF7\u7A0D\u5019...");
      await apiClient.indexItem(item.id, pdfPath);
      const response = await apiClient.chat({
        item_id: item.id,
        question: "\u8BF7\u603B\u7ED3\u8FD9\u7BC7\u6587\u732E\u7684\u4E3B\u8981\u5185\u5BB9\uFF0C\u5305\u62EC\u7814\u7A76\u95EE\u9898\u3001\u65B9\u6CD5\u3001\u7ED3\u679C\u548C\u7ED3\u8BBA\u3002",
        use_rag: true
      });
      alert(window, "\u6587\u732E\u603B\u7ED3", response.answer);
    } catch (error) {
      alert(window, "\u9519\u8BEF", `\u603B\u7ED3\u5931\u8D25: ${error}`);
    }
  }
  async function onSearch() {
    const result = window.prompt("\u8BED\u4E49\u641C\u7D22", "\u8F93\u5165\u641C\u7D22\u5185\u5BB9:");
    if (!result) return;
    try {
      const items = ZoteroPane.getSelectedItems();
      const itemId = items.length > 0 ? items[0].id : void 0;
      const response = await apiClient.search(result, itemId, 10);
      if (response.results.length === 0) {
        alert(window, "\u63D0\u793A", "\u672A\u627E\u5230\u76F8\u5173\u7ED3\u679C");
        return;
      }
      let message = `\u627E\u5230 ${response.results.length} \u4E2A\u76F8\u5173\u7ED3\u679C:

`;
      response.results.forEach((r, i) => {
        message += `\u3010${i + 1}\u3011${r.chapter_title}
${r.content}

`;
      });
      alert(window, "\u641C\u7D22\u7ED3\u679C", message);
    } catch (error) {
      alert(window, "\u9519\u8BEF", `\u641C\u7D22\u5931\u8D25: ${error}`);
    }
  }
  var hooks_default = {
    onStartup,
    onMainWindowLoad,
    onMainWindowUnload,
    onShutdown
  };

  // src/addon.ts
  var Addon = class {
    data;
    hooks;
    api;
    constructor() {
      this.data = {
        alive: true,
        config,
        env: "production",
        initialized: false
      };
      this.hooks = hooks_default;
      this.api = {};
    }
  };
  var addon_default = Addon;

  // src/index.ts
  if (!Zotero[config.addonInstance]) {
    Zotero[config.addonInstance] = new addon_default();
    Zotero[config.addonInstance].hooks.onStartup();
  }
})();
