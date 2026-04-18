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
  registerMenu();

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
  Zotero.debug("AIReader: win.document element:", win.document ? "exists" : "null");

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

  // Load localization
  win.document.l10n?.addResourceIds([`${config.addonRef}-addon.ftl`]);

  injectStyle(win);
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

function registerMenu() {
  Zotero.debug("AI Reader: registerMenu called");
  // Minimal test - just a separator
  Zotero.MenuManager.registerMenu({
    menuID: "zotero-air-reader-menu",
    pluginID: config.addonID,
    target: "main/library/item",
    menus: [
      {
        menuType: "separator",
      },
    ],
  });
  Zotero.debug("AI Reader: menu registered");
}

function alert(win: Window, title: string, msg: string) {
  const prom = new win.XULDialog({
    buttons: [{ label: "OK", focus: true }],
    title: title,
    message: msg,
  });
  prom.show();
}

function getMainWindow(): Window {
  return Zotero.getMainWindow();
}

async function onAIChat() {
  const win = getMainWindow();
  const items = ZoteroPane.getSelectedItems();
  if (!items.length) {
    alert(win, "提示", "请先选择一个文献条目");
    return;
  }

  const item = items[0];
  const attachments = item.attachments;
  if (!attachments || attachments.length === 0) {
    alert(win, "提示", "请选择一个包含 PDF 附件的文献条目");
    return;
  }

  const attachment = attachments[0];
  const pdfPath = attachment.filePath;
  if (!pdfPath) {
    alert(win, "提示", "无法获取 PDF 文件路径");
    return;
  }

  aiChatPanel.open(item.id, pdfPath);
}

async function onSummarize() {
  const win = getMainWindow();
  const items = ZoteroPane.getSelectedItems();
  if (!items.length) {
    alert(win, "提示", "请先选择一个文献条目");
    return;
  }

  const item = items[0];
  const attachments = item.attachments;
  if (!attachments || attachments.length === 0) {
    alert(win, "提示", "请选择一个包含 PDF 附件的文献条目");
    return;
  }

  const attachment = attachments[0];
  const pdfPath = attachment.filePath;
  if (!pdfPath) {
    alert(win, "提示", "无法获取 PDF 文件路径");
    return;
  }

  try {
    const health = await apiClient.health();
    if (health.status !== "ok") {
      alert(win, "提示", "后端服务未运行，请先启动服务");
      return;
    }

    alert(win, "提示", "正在生成总结，请稍候...");

    await apiClient.indexItem(item.id, pdfPath);
    const response = await apiClient.chat({
      item_id: item.id,
      question: "请总结这篇文献的主要内容，包括研究问题、方法、结果和结论。",
      use_rag: true,
    });

    alert(win, "文献总结", response.answer);
  } catch (error) {
    alert(win, "错误", `总结失败: ${error}`);
  }
}

async function onSearch() {
  const win = getMainWindow();
  const result = win.prompt("语义搜索", "输入搜索内容:");
  if (!result) return;

  try {
    const items = ZoteroPane.getSelectedItems();
    const itemId = items.length > 0 ? items[0].id : undefined;

    const response = await apiClient.search(result, itemId, 10);

    if (response.results.length === 0) {
      alert(win, "提示", "未找到相关结果");
      return;
    }

    let message = `找到 ${response.results.length} 个相关结果:\n\n`;
    response.results.forEach((r, i) => {
      message += `【${i + 1}】${r.chapter_title}\n${r.content}\n\n`;
    });

    alert(win, "搜索结果", message);
  } catch (error) {
    alert(win, "错误", `搜索失败: ${error}`);
  }
}

export default {
  onStartup,
  onMainWindowLoad,
  onMainWindowUnload,
  onShutdown,
  onPrefsEvent,
};
