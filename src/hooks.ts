import { config } from "../package.json";
import { aiPanel } from "./modules/ai-panel";
import { isEnabled } from "./utils/prefs";

declare const rootURI: string;

// Track registered resources for cleanup
let registeredSectionID: string | false = false;
let registeredPrefsPaneID: string | false = false;
let readerListenersRegistered = false;

async function onStartup() {
  await Zotero.initializationPromise;
  await Zotero.unlockPromise;
  await Zotero.uiReadyPromise;

  Zotero.debug("AI Reader: onStartup called");

  // Initialize localization
  const l10n = new Localization([`${config.addonRef}-addon.ftl`], true);
  Zotero[config.addonInstance].data.locale = { current: l10n };

  // CRITICAL: Add FTL resources to main window BEFORE registering menus
  // Otherwise menu l10nID won't resolve and labels will be empty
  const mainWindow = Zotero.getMainWindow();
  if (mainWindow && mainWindow.document.l10n) {
    mainWindow.document.l10n.addResourceIds([`${config.addonRef}-addon.ftl`]);
    Zotero.debug("AI Reader: FTL resources added to main window");
  }

  registerNotifier();
  registerPrefs();
  registerMenu();
  registerReaderListeners();

  // Register the AI panel in the right-side item pane
  registeredSectionID = aiPanel.register();

  Zotero[config.addonInstance].data.initialized = true;
  Zotero.debug("AI Reader: startup complete");
}

function onShutdown() {
  Zotero.debug("AI Reader: onShutdown called");

  // Unregister the AI panel section
  aiPanel.unregister();

  // Unregister reader event listeners
  unregisterReaderListeners();

  // Unregister preference pane (also auto-unregistered by Zotero, but be explicit)
  if (registeredPrefsPaneID) {
    try {
      Zotero.PreferencePanes.unregister(registeredPrefsPaneID);
    } catch (e) {
      Zotero.debug("AI Reader: error unregistering prefs pane: " + e);
    }
    registeredPrefsPaneID = false;
  }

  // @ts-ignore - Plugin instance is not typed
  delete Zotero[config.addonInstance];
}

async function onMainWindowLoad(win: Window): Promise<void> {
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

  // Load localization
  win.document.l10n?.addResourceIds([`${config.addonRef}-addon.ftl`]);

  // Inject CSS for the AI panel
  injectCSS(win);
}

function injectCSS(win: Window) {
  const link = win.document.createElement("link");
  link.id = "zotero-ai-reader-css";
  link.rel = "stylesheet";
  link.href = `chrome://zoteroAIRreader/content/ai-panel.css`;
  win.document.documentElement.appendChild(link);
}

function onMainWindowUnload(win: Window): void {
  Zotero.debug("AI Reader: onMainWindowUnload called");
  // Remove injected CSS
  const css = win.document.getElementById("zotero-ai-reader-css");
  if (css) css.remove();
}

// ─── Notifier ────────────────────────────────────────────────

function registerNotifier() {
  Zotero.Notifier.registerObserver(
    {
      notify: (
        event: string,
        type: string,
        ids: Array<string | number>,
        extraData: { [key: string]: any },
      ) => {
        Zotero.debug(`AI Reader: notified ${event} ${type}`);
      },
    },
    ["item"],
    "zotero-ai-reader",
  );
}

// ─── Preferences ─────────────────────────────────────────────

function registerPrefs() {
  if (registeredPrefsPaneID) {
    Zotero.debug("AI Reader: prefs pane already registered, skipping");
    return;
  }
  Zotero.debug("AI Reader: registerPrefs called");
  try {
    // Zotero 8+/9: Zotero.PreferencePanes.register() (NOT Zotero.PrefsPane)
    registeredPrefsPaneID = Zotero.PreferencePanes.register({
      pluginID: config.addonID,
      src: rootURI + "content/preferences.xhtml",
      id: "zotero-ai-reader-prefs",
      label: "AI Reader",
      image: rootURI + "content/icons/icon20.svg",
    });
    Zotero.debug("AI Reader: PreferencePanes registered, id=" + registeredPrefsPaneID);
  } catch (e) {
    Zotero.debug("AI Reader ERROR in registerPrefs: " + e);
  }
}

function onPrefsEvent(event: string, data: { window: Window }) {
  Zotero.debug("AI Reader: onPrefsEvent called " + event);
}

// ─── Menu ────────────────────────────────────────────────────

function registerMenu() {
  Zotero.debug("AI Reader: registerMenu called");

  // Zotero 9 MenuManager.registerMenu() top-level options are:
  //   { menuID, pluginID, target, menus }
  // Top-level DOES NOT take menuType/l10nID/icon. Those live on each item in `menus`.
  // Valid menuType values inside menus: "menuitem" | "separator" | "submenu" (NOT "menu")
  try {
    Zotero.MenuManager.registerMenu({
      menuID: "air-reader-menu",
      pluginID: config.addonID,
      target: "main/library/item",
      menus: [
        {
          menuType: "submenu",
          l10nID: `${config.addonRef}-zotero-air-reader-menu-label`,
          icon: rootURI + "content/icons/icon16.svg",
          menus: [
            {
              menuType: "menuitem",
              l10nID: `${config.addonRef}-zotero-air-reader-menu-ai-chat`,
              onCommand: () => onAIChat(),
            },
            {
              menuType: "menuitem",
              l10nID: `${config.addonRef}-zotero-air-reader-menu-summarize`,
              onCommand: () => onSummarize(),
            },
            {
              menuType: "menuitem",
              l10nID: `${config.addonRef}-zotero-air-reader-menu-search`,
              onCommand: () => onSearch(),
            },
          ],
        },
      ],
    });
    Zotero.debug("AI Reader: menu registered");
  } catch (e) {
    Zotero.debug("AI Reader ERROR in registerMenu: " + e);
  }
}

// ─── Reader Event Listeners ──────────────────────────────────

function textSelectionHandler(event: any) {
  const { reader, doc, params, append } = event;
  const selectedText = params?.annotation?.text || "";
  if (!selectedText) return;

  const container = doc.createElement("div");
  container.style.cssText = "padding: 4px 8px; cursor: pointer; color: #0078d7; font-size: 12px;";
  container.textContent = "\u{1F916} AI 分析选中文本";
  container.addEventListener("click", () => {
    Zotero.debug(`AI Reader: text selected for analysis: ${selectedText.substring(0, 50)}...`);
    aiPanel.setSelectedText(selectedText);
  });
  append(container);
}

function toolbarHandler(event: any) {
  const { reader, doc, append } = event;

  // Create AI button for the reader toolbar
  const btn = doc.createElement("button");
  btn.className = "toolbar-button";
  btn.style.cssText = "display: flex; align-items: center; gap: 4px; padding: 4px 8px; cursor: pointer; font-size: 12px; border: none; background: transparent; color: inherit; border-radius: 4px;";
  btn.title = "AI Assistant";

  const icon = doc.createElement("span");
  icon.textContent = "\u{1F916}";
  icon.style.fontSize = "14px";
  btn.appendChild(icon);

  const label = doc.createElement("span");
  label.textContent = "AI";
  label.style.fontWeight = "500";
  btn.appendChild(label);

  btn.addEventListener("mouseenter", () => {
    btn.style.background = "var(--fill-quinary, rgba(0,0,0,0.06))";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.background = "transparent";
  });

  // Click: toggle the item pane visibility via the MAIN window (not reader iframe)
  btn.addEventListener("click", () => {
    Zotero.debug("AI Reader: toolbar AI button clicked");
    try {
      const mainWin = Zotero.getMainWindow();
      if (!mainWin) return;

      const itemPane = mainWin.document.getElementById("zotero-item-pane");
      if (itemPane) {
        if (itemPane.getAttribute("collapsed") === "true") {
          itemPane.setAttribute("collapsed", "false");
        }
      }
    } catch (e) {
      Zotero.debug("AI Reader: toolbar toggle error: " + e);
    }
  });

  append(btn);
}

function registerReaderListeners() {
  if (readerListenersRegistered) {
    Zotero.debug("AI Reader: reader listeners already registered, skipping");
    return;
  }

  Zotero.Reader.registerEventListener(
    "renderTextSelectionPopup",
    textSelectionHandler,
    config.addonID,
  );

  Zotero.Reader.registerEventListener(
    "renderToolbar",
    toolbarHandler,
    config.addonID,
  );

  readerListenersRegistered = true;
  Zotero.debug("AI Reader: reader event listeners registered");
}

function unregisterReaderListeners() {
  if (!readerListenersRegistered) return;

  Zotero.Reader.unregisterEventListener(
    "renderTextSelectionPopup",
    textSelectionHandler,
  );

  Zotero.Reader.unregisterEventListener(
    "renderToolbar",
    toolbarHandler,
  );

  readerListenersRegistered = false;
  Zotero.debug("AI Reader: reader event listeners unregistered");
}

// ─── Feature Handlers (menu commands) ────────────────────────

async function onAIChat() {
  Zotero.debug("AI Reader: AI Chat menu triggered");
  // Ensure the item pane is visible so the AI panel section is accessible
  try {
    const mainWin = Zotero.getMainWindow();
    if (!mainWin) return;
    const itemPane = mainWin.document.getElementById("zotero-item-pane");
    if (itemPane && itemPane.getAttribute("collapsed") === "true") {
      itemPane.setAttribute("collapsed", "false");
    }
  } catch (e) {
    Zotero.debug("AI Reader: onAIChat error: " + e);
  }
}

async function onSummarize() {
  Zotero.debug("AI Reader: Summarize menu triggered");
  // Open item pane, then the panel's skill click will be handled by the user
  await onAIChat();
}

async function onSearch() {
  Zotero.debug("AI Reader: Search menu triggered — feature in development");
}

export default {
  onStartup,
  onMainWindowLoad,
  onMainWindowUnload,
  onShutdown,
};
