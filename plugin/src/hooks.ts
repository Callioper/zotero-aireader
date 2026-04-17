import { config } from "../package.json";
import { getPref } from "./utils/prefs";

const hooks = {
  onStartup() {
    ztoolkit.log("startup-begin");
    this.registerNotifier();
    this.registerPrefs();
    this.registerMenu();
  },

  onShutdown() {
    ztoolkit.log("startup-finish");
    this.data.initialized = false;
  },

  async onMainWindowLoad(window: Window) {
    this.registerRightClickMenuItem(window);
    this.registerKeyboardShortcuts(window);
  },

  onMainWindowUnload(window: Window) {
    ztoolkit.unregisterAll();
  },

  onPrefsEvent(event: string, data: { window: Window }) {
    switch (event) {
      case "load":
        this.initPrefsPanel(data.window);
        break;
    }
  },

  registerNotifier() {
    Zotero.Notifier.registerObserver(
      {
        notify: (
          event: string,
          type: string,
          ids: Array<string | number>,
          extraData: { [key: string]: any },
        ) => {
          if (event === "add" && type === "item") {
            // Handle new item added
          }
        },
      },
      ["item"],
      "zotero-ai-reader",
    );
  },

  registerPrefs() {
    ztoolkit.PrefsPane.add({
      pluginID: config.addonID,
      src: rootURI + "content/preferences.xhtml",
      label: "AI Reader",
      iconURL: rootURI + "content/icons/favicon.png",
    });
  },

  registerMenu() {
    ztoolkit.Menu.register("item", {
      label: "AI Reader",
      icon: rootURI + "content/icons/favicon.png",
      children: [
        {
          label: "AI 问答",
          icon: rootURI + "content/icons/favicon.png",
          command: () => {
            this.onAIChat();
          },
        },
        {
          label: "总结文献",
          icon: rootURI + "content/icons/favicon.png",
          command: () => {
            this.onSummarize();
          },
        },
        {
          label: "语义搜索",
          icon: rootURI + "content/icons/favicon.png",
          command: () => {
            this.onSearch();
          },
        },
      ],
    });
  },

  registerRightClickMenuItem(window: Window) {
    // Register right-click menu items using zotero-plugin-toolkit
  },

  registerKeyboardShortcuts(window: Window) {
    // Register keyboard shortcuts
  },

  initPrefsPanel(window: Window) {
    // Initialize preferences panel
  },

  async onAIChat() {
    const items = ZoteroPane.getSelectedItems();
    if (!items.length) return;

    const item = items[0];
    const attachment = item.getAttachment?.();
    if (!attachment) return;

    const pdfPath = await attachment.getFilePath?.();
    if (!pdfPath) return;

    // TODO: Call backend API to index and chat
    ztoolkit.log("AI Chat requested for:", pdfPath);
  },

  async onSummarize() {
    ztoolkit.log("Summarize requested");
  },

  async onSearch() {
    ztoolkit.log("Search requested");
  },
};

export default hooks;
