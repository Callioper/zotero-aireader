import { config } from "../package.json";
import { apiClient } from "./modules/api-client";
import { aiChatPanel } from "./modules/ai-chat";

// rootURI should be set globally from bootstrap.js
declare const rootURI: string;

async function onStartup() {
  await Zotero.initializationPromise;
  await Zotero.unlockPromise;
  await Zotero.uiReadyPromise;

  ztoolkit.log("AI Reader: onStartup called, rootURI:", rootURI);
  registerNotifier();
  registerPrefs();
  ztoolkit.log("AI Reader: onStartup completed");
}

function onShutdown() {
  ztoolkit.log("AI Reader: onShutdown called");
  aiChatPanel.close();
  ztoolkit.unregisterAll();
  // @ts-ignore - Plugin instance is not typed
  delete Zotero[config.addonInstance];
}

async function onMainWindowLoad(win: Window): Promise<void> {
  ztoolkit.log("AI Reader: onMainWindowLoad called, window:", win);

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
  ztoolkit.log("AI Reader: document ready, registering menu");

  registerMenu(win);
  ztoolkit.log("AI Reader: menu registered");
}

function onMainWindowUnload(win: Window): void {
  ztoolkit.log("AI Reader: onMainWindowUnload called");
  ztoolkit.unregisterAll();
}

function registerNotifier() {
  Zotero.Notifier.registerObserver(
    {
      notify: (
        event: string,
        type: string,
        ids: Array<string | number>,
        extraData: { [key: string]: any },
      ) => {
        ztoolkit.log("AI Reader: notified", event, type, ids);
      },
    },
    ["item"],
    "zotero-ai-reader",
  );
}

function registerPrefs() {
  ztoolkit.log("AI Reader: registerPrefs called, ztoolkit:", ztoolkit, "rootURI:", rootURI);
  if (!ztoolkit) {
    ztoolkit.log("AI Reader ERROR: ztoolkit is undefined!");
    return;
  }
  try {
    ztoolkit.PrefsPane.add({
      pluginID: config.addonID,
      src: rootURI + "content/preferences.xhtml",
      label: "AI Reader",
      iconURL: rootURI + "content/icons/favicon.png",
    });
    ztoolkit.log("AI Reader: PrefsPane added");
  } catch (e) {
    ztoolkit.log("AI Reader ERROR in registerPrefs:", e);
  }
}

function registerMenu(win: Window) {
  const menuPopup = win.document.getElementById("item-context-menu");
  if (!menuPopup) {
    ztoolkit.log("AI Reader ERROR: item-context-menu not found");
    return;
  }
  ztoolkit.log("AI Reader: found item-context-menu");

  const submenu = win.document.createElement("menu");
  submenu.setAttribute("id", "zotero-air-reader-menu");
  submenu.setAttribute("label", "AI Reader");

  const menupopup = win.document.createElement("menupopup");

  const menuItems = [
    { label: "AI 问答", command: () => onAIChat() },
    { label: "总结文献", command: () => onSummarize() },
    { label: "语义搜索", command: () => onSearch() },
  ];

  for (const item of menuItems) {
    const menuitem = win.document.createElement("menuitem");
    menuitem.setAttribute("label", item.label);
    menuitem.addEventListener("command", item.command);
    menupopup.appendChild(menuitem);
  }

  submenu.appendChild(menupopup);
  menuPopup.appendChild(submenu);
  ztoolkit.log("AI Reader: menu items added");
}

async function onAIChat() {
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
}

async function onSummarize() {
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
}

async function onSearch() {
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
}

export default {
  onStartup,
  onMainWindowLoad,
  onMainWindowUnload,
  onShutdown,
};
