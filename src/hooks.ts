import { config } from "../package.json";
import { getPref } from "./utils/prefs";
import { apiClient } from "./modules/api-client";
import { aiChatPanel } from "./modules/ai-chat";

const hooks = {
  onStartup() {
    ztoolkit.log("startup-begin");
    this.registerNotifier();
    this.registerPrefs();
  },

  onShutdown() {
    ztoolkit.log("startup-finish");
    aiChatPanel.close();
  },

  async onMainWindowLoad(window: Window) {
    this.registerMenu();
  },

  onMainWindowUnload(window: Window) {
    ztoolkit.unregisterAll();
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
          // Handle item changes if needed
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
    const menuPopup = document.getElementById("item-context-menu");
    if (!menuPopup) {
      ztoolkit.log("item-context-menu not found");
      return;
    }

    const submenu = ztoolkit.createElement(document, "menu", {
      namespace: "xul",
      attributes: {
        label: "AI Reader",
        id: "zotero-air-reader-menu",
      },
    });

    const menupopup = ztoolkit.createElement(document, "menupopup", {
      namespace: "xul",
    });

    const menuItems = [
      { label: "AI 问答", command: () => this.onAIChat() },
      { label: "总结文献", command: () => this.onSummarize() },
      { label: "语义搜索", command: () => this.onSearch() },
    ];

    for (const item of menuItems) {
      const menuitem = ztoolkit.createElement(document, "menuitem", {
        namespace: "xul",
        attributes: { label: item.label },
        listeners: [
          {
            type: "command",
            listener: item.command,
          },
        ],
      });
      menupopup.appendChild(menuitem);
    }

    submenu.appendChild(menupopup);
    menuPopup.appendChild(submenu);
  },

  async onAIChat() {
    const items = ZoteroPane.getSelectedItems();
    if (!items.length) {
      ztoolkit.alert("请先选择一个文献条目");
      return;
    }

    const item = items[0];
    const attachments = item.attachments;
    if (!attachments || attachments.length === 0) {
      ztoolkit.alert("请选择一个包含 PDF 附件的文献条目");
      return;
    }

    const attachment = attachments[0];
    const pdfPath = attachment.filePath;
    if (!pdfPath) {
      ztoolkit.alert("无法获取 PDF 文件路径");
      return;
    }

    aiChatPanel.open(item.id, pdfPath);
  },

  async onSummarize() {
    const items = ZoteroPane.getSelectedItems();
    if (!items.length) {
      ztoolkit.alert("请先选择一个文献条目");
      return;
    }

    const item = items[0];
    const attachments = item.attachments;
    if (!attachments || attachments.length === 0) {
      ztoolkit.alert("请选择一个包含 PDF 附件的文献条目");
      return;
    }

    const attachment = attachments[0];
    const pdfPath = attachment.filePath;
    if (!pdfPath) {
      ztoolkit.alert("无法获取 PDF 文件路径");
      return;
    }

    try {
      const health = await apiClient.health();
      if (health.status !== "ok") {
        ztoolkit.alert("后端服务未运行，请先启动服务");
        return;
      }

      ztoolkit.alert("正在生成总结，请稍候...");

      await apiClient.indexItem(item.id, pdfPath);
      const response = await apiClient.chat({
        item_id: item.id,
        question: "请总结这篇文献的主要内容，包括研究问题、方法、结果和结论。",
        use_rag: true,
      });

      ztoolkit.alert("文献总结:\n\n" + response.answer);
    } catch (error) {
      ztoolkit.alert(`总结失败: ${error}`);
    }
  },

  async onSearch() {
    const result = await ztoolkit.prompt("语义搜索", "输入搜索内容:");
    if (!result) return;

    try {
      const items = ZoteroPane.getSelectedItems();
      const itemId = items.length > 0 ? items[0].id : undefined;

      const response = await apiClient.search(result, itemId, 10);

      if (response.results.length === 0) {
        ztoolkit.alert("未找到相关结果");
        return;
      }

      let message = `找到 ${response.results.length} 个相关结果:\n\n`;
      response.results.forEach((r, i) => {
        message += `【${i + 1}】${r.chapter_title}\n${r.content}\n\n`;
      });

      ztoolkit.alert(message);
    } catch (error) {
      ztoolkit.alert(`搜索失败: ${error}`);
    }
  },
};

export default hooks;
