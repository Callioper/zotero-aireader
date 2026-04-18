import { config } from "../package.json";
import { apiClient } from "./modules/api-client";
import { aiChatPanel } from "./modules/ai-chat";

declare const rootURI: string;

async function onStartup() {
  await Zotero.initializationPromise;
  await Zotero.unlockPromise;
  await Zotero.uiReadyPromise;

  Zotero.debug("AI Reader: onStartup called");
  registerNotifier();
  registerPrefs();
  registerStyle();

  Zotero[config.addonInstance].data.initialized = true;
}

function onShutdown() {
  Zotero.debug("AI Reader: onShutdown called");
  aiChatPanel.close();
  // @ts-ignore - Plugin instance is not typed
  delete Zotero[config.addonInstance];
}

async function onMainWindowLoad(win: Window): Promise<void> {
  Zotero.debug("AI Reader: onMainWindowLoad called, window type:", typeof win);
  Zotero.debug("AI Reader: win.document element:", win.document ? "exists" : "null");

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
  injectStyle(win);
  registerMenu(win);
}

function injectStyle(win: Window) {
  const style = `
    #zotero-air-reader-menu {
      font-weight: bold;
    }
  `;
  const styleElement = win.document.createElement("style");
  styleElement.textContent = style;
  win.document.documentElement.appendChild(styleElement);
}

function onMainWindowUnload(win: Window): void {
  Zotero.debug("AI Reader: onMainWindowUnload called");
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
        Zotero.debug("AI Reader: notified", event, type, ids);
      },
    },
    ["item"],
    "zotero-ai-reader",
  );
}

function registerPrefs() {
  Zotero.debug("AI Reader: registerPrefs called");
  try {
    Zotero.PrefsPane.register({
      plugin: {
        addonID: config.addonID,
        rootURI: rootURI,
        onPrefsEvent: onPrefsEvent,
      },
      src: rootURI + "content/preferences.xhtml",
    });
    Zotero.debug("AI Reader: PrefsPane registered");
  } catch (e) {
    Zotero.debug("AI Reader ERROR in registerPrefs: " + e);
  }
}

function registerStyle() {
  // Style registration handled per-window in onMainWindowLoad
}

function onPrefsEvent(event: string, data: { window: Window }) {
  Zotero.debug("AI Reader: onPrefsEvent called", event);
  if (event === "load") {
    Zotero.debug("AI Reader: prefs pane loaded");
  }
}

function registerMenu(win: Window) {
  Zotero.debug("AI Reader: registerMenu called");

  function tryRegister() {
    const menuPopup = win.document.getElementById("zotero-itemmenu");
    if (!menuPopup) {
      Zotero.debug("AI Reader ERROR: zotero-itemmenu not found, retrying...");
      return false;
    }
    Zotero.debug("AI Reader: found zotero-itemmenu");

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
    Zotero.debug("AI Reader: menu items added");
    return true;
  }

  if (!tryRegister()) {
    setTimeout(() => {
      if (tryRegister()) {
        Zotero.debug("AI Reader: menu registered after retry");
      }
    }, 1000);
  }
}

function alert(win: Window, title: string, msg: string) {
  const prom = new win.XULDialog({
    buttons: [{ label: "OK", focus: true }],
    title: title,
    message: msg,
  });
  prom.show();
}

async function onAIChat() {
  const items = ZoteroPane.getSelectedItems();
  if (!items.length) {
    alert(window, "提示", "请先选择一个文献条目");
    return;
  }

  const item = items[0];
  const attachments = item.attachments;
  if (!attachments || attachments.length === 0) {
    alert(window, "提示", "请选择一个包含 PDF 附件的文献条目");
    return;
  }

  const attachment = attachments[0];
  const pdfPath = attachment.filePath;
  if (!pdfPath) {
    alert(window, "提示", "无法获取 PDF 文件路径");
    return;
  }

  aiChatPanel.open(item.id, pdfPath);
}

async function onSummarize() {
  const items = ZoteroPane.getSelectedItems();
  if (!items.length) {
    alert(window, "提示", "请先选择一个文献条目");
    return;
  }

  const item = items[0];
  const attachments = item.attachments;
  if (!attachments || attachments.length === 0) {
    alert(window, "提示", "请选择一个包含 PDF 附件的文献条目");
    return;
  }

  const attachment = attachments[0];
  const pdfPath = attachment.filePath;
  if (!pdfPath) {
    alert(window, "提示", "无法获取 PDF 文件路径");
    return;
  }

  try {
    const health = await apiClient.health();
    if (health.status !== "ok") {
      alert(window, "提示", "后端服务未运行，请先启动服务");
      return;
    }

    alert(window, "提示", "正在生成总结，请稍候...");

    await apiClient.indexItem(item.id, pdfPath);
    const response = await apiClient.chat({
      item_id: item.id,
      question: "请总结这篇文献的主要内容，包括研究问题、方法、结果和结论。",
      use_rag: true,
    });

    alert(window, "文献总结", response.answer);
  } catch (error) {
    alert(window, "错误", `总结失败: ${error}`);
  }
}

async function onSearch() {
  const result = window.prompt("语义搜索", "输入搜索内容:");
  if (!result) return;

  try {
    const items = ZoteroPane.getSelectedItems();
    const itemId = items.length > 0 ? items[0].id : undefined;

    const response = await apiClient.search(result, itemId, 10);

    if (response.results.length === 0) {
      alert(window, "提示", "未找到相关结果");
      return;
    }

    let message = `找到 ${response.results.length} 个相关结果:\n\n`;
    response.results.forEach((r, i) => {
      message += `【${i + 1}】${r.chapter_title}\n${r.content}\n\n`;
    });

    alert(window, "搜索结果", message);
  } catch (error) {
    alert(window, "错误", `搜索失败: ${error}`);
  }
}

export default {
  onStartup,
  onMainWindowLoad,
  onMainWindowUnload,
  onShutdown,
  onPrefsEvent,
};
