# Zotero AI Reader Plugin - Development Instructions

## Project Overview

Zotero AI Reader is a **Zotero 9** plugin that adds an AI-powered reading assistant panel to the **PDF reader's right-side item pane**. 

- **Plugin ID:** `zotero-ai-reader@callioper`
- **Addon Instance:** `Zotero.ZoteroAIRreader`
- **Build Tool:** `zotero-plugin-scaffold` (esbuild, target: firefox115)
- **Architecture:** Pure built-in mode - plugin directly calls LLM APIs with embedded RAG engine

## Architecture

```
Zotero Plugin (TypeScript)
     |
     |- ItemPaneManager (right sidebar UI)
     |- Reader event listeners
     |- Annotation creation
     |- Menu registration
     |- Skill system (6 AI skills)
     |- Built-in LLM client (OpenAI/DeepSeek/Ollama compatible)
     |- Built-in RAG engine (chunking + embedding + vector search)
```

## Critical: Zotero 9 Plugin API Reference

All API documentation is in `D:\opencode\zotero-plugin-docs\` (HTML format from VitePress).
When you need API details, read those files and extract the JavaScript code from `<span>` tags.

### Right Sidebar Panel (PRIMARY UI - MUST USE THIS)

Use `Zotero.ItemPaneManager.registerSection()` to add the AI panel to the right-side item pane.
This is THE correct API for injecting UI into the reader's right sidebar.

```js
Zotero.ItemPaneManager.registerSection({
  paneID: "zotero-ai-reader-panel",
  pluginID: "zotero-ai-reader@callioper",
  header: {
    l10nID: "zotero-air-reader-panel-header",
    icon: "chrome://zoteroAIRreader/content/icons/icon16.svg",
  },
  sidenav: {
    l10nID: "zotero-air-reader-panel-sidenav",
    icon: "chrome://zoteroAIRreader/content/icons/icon20.svg",
  },
  onInit: ({ paneID, doc, body }) => { /* setup */ },
  onDestroy: ({ paneID, doc, body }) => { /* cleanup */ },
  onItemChange: ({ item, tabType, setEnabled }) => {
    setEnabled(tabType === "reader" || item?.isRegularItem());
  },
  onRender: ({ doc, body, item }) => { /* sync DOM creation */ },
  onAsyncRender: async ({ body, item }) => { /* async operations */ },
  onToggle: ({ body, item }) => { /* refresh on show */ },
});
// Returns a registeredID string; call Zotero.ItemPaneManager.unregisterSection(registeredID) on shutdown
```

### Reader UI Injection (for text selection popup, toolbar buttons)

```js
Zotero.Reader.registerEventListener(
  "renderTextSelectionPopup",  // or "renderToolbar", "renderSidebarAnnotationHeader"
  (event) => {
    const { reader, doc, params, append } = event;
    // params.annotation.text = selected text
    const container = doc.createElement("div");
    append(container);
  },
  "zotero-ai-reader@callioper"
);
```

### Creating Highlight Annotations Programmatically

```js
const annotation = new Zotero.Item("annotation");
annotation.parentID = attachmentItemID;
annotation.annotationType = "highlight";
annotation.annotationText = "highlighted text";
annotation.annotationComment = "AI note";
annotation.annotationColor = "#ffd400";
annotation.annotationPosition = JSON.stringify({
  pageIndex: 0,
  rects: [[x1, y1, x2, y2], ...]  // PDF coordinate system
});
annotation.addTag("AI-Generated");
await annotation.saveTx();
```

### Getting PDF Full Text

```js
const attachmentIDs = item.getAttachments();
for (const id of attachmentIDs) {
  const attachment = Zotero.Items.get(id);
  if (attachment.isPDFAttachment()) {
    const fullText = await attachment.attachmentText;
  }
}
```

### HTTP Requests (for calling backend)

```js
const req = await Zotero.HTTP.request("POST", url, {
  body: JSON.stringify(payload),
  headers: { "Content-Type": "application/json" },
  responseType: "json",
});
const data = req.response;
```

Alternatively, `fetch()` is available in the Zotero sandbox (already used in api-client.ts).

### Menu Registration (CRITICAL - Correct Structure)

```js
// Top-level options: menuID, pluginID, target, menus
// Valid menuType values: "menuitem", "separator", "submenu" (NOT "menu")
Zotero.MenuManager.registerMenu({
  menuID: "unique-menu-id",
  pluginID: "zotero-ai-reader@callioper",
  target: "main/library/item",
  menus: [{
    menuType: "submenu",  // ← Use "submenu" for nested menus
    l10nID: "plugin-menu-label",  // ← l10nID goes here, not at top level
    icon: "chrome://...",
    menus: [  // ← Child items
      { menuType: "menuitem", l10nID: "...", onCommand: () => { ... } },
    ],
  }],
});
```

**IMPORTANT**: Menu l10n requires:
1. FTL files use `.label` attribute format: `key =\n  .label = Text`
2. Locale must be registered in `bootstrap.js`: `["locale", "addonRef", "zh-CN", rootURI + "locale/zh-CN/"]`
3. FTL must be added to main window **before** `registerMenu()`: `mainWindow.document.l10n.addResourceIds([...])`

### Preferences Registration

```js
// Zotero 9 API: Zotero.PreferencePanes (NOT PrefsPane)
Zotero.PreferencePanes.register({
  pluginID: "zotero-ai-reader@callioper",
  src: rootURI + "content/preferences.xhtml",
  id: "zotero-ai-reader-prefs",
  label: "AI Reader",
  image: rootURI + "content/icons/icon20.svg",
});
// Returns a registration ID; call Zotero.PreferencePanes.unregister(id) on shutdown
```

## File Structure

```
ai-reader-zotero-plugin/
├── src/
│   ├── index.ts                  # Entry point, creates Addon singleton
│   ├── addon.ts                  # Addon class (data, hooks, api)
│   ├── hooks.ts                  # Lifecycle: startup/shutdown, menu, prefs, reader listeners
│   ├── utils/
│   │   ├── prefs.ts              # Preference get/set helpers
│   │   └── ztoolkit.ts           # Toolkit utilities
│   └── modules/
│       ├── ai-panel.ts           # Main AI panel (ItemPaneManager section)
│       ├── api-client.ts         # HTTP client for Python backend
│       ├── pdf-text.ts           # PDF text extraction and metadata
│       ├── annotation-manager.ts # Quote-to-annotation conversion
│       └── skills/               # AI Skill system
│           ├── types.ts          # Interfaces: AISkill, SkillContext, SkillResult
│           ├── index.ts          # Registry: ALL_SKILLS array, getSkillById()
│           ├── summary.ts        # Smart Summary skill
│           ├── concept-explain.ts # Concept Explanation skill
│           ├── argument-analysis.ts # Argument Analysis skill
│           ├── character-tracking.ts # Character/Entity Tracking skill
│           ├── quote-collector.ts # Quote Collection skill
│           └── reading-guide.ts  # Reading Guide skill
├── addon/
│   ├── manifest.json             # Plugin manifest (SVG icons)
│   ├── bootstrap.js              # Zotero bootstrap lifecycle
│   ├── prefs.js                  # Default preferences
│   ├── content/
│   │   ├── preferences.xhtml     # Preferences panel
│   │   ├── ai-panel.css          # AI panel styles
│   │   └── icons/
│   │       ├── icon16.svg        # 16x16 icon
│   │       ├── icon20.svg        # 20x20 sidenav icon
│   │       └── icon48.svg        # 48x48 icon
│   └── locale/
│       ├── en-US/addon.ftl       # English strings
│       └── zh-CN/addon.ftl       # Chinese strings
├── service/                      # Python FastAPI backend
│   ├── src/
│   │   ├── main.py               # FastAPI app
│   │   ├── llm.py                # LLM manager (supports system_prompt param)
│   │   ├── config.py             # Settings
│   │   └── routes/
│   │       ├── chat.py           # /api/chat (supports skill_prompt field)
│   │       ├── index.py          # /api/index
│   │       └── search.py         # /api/search
│   └── requirements.txt
├── docs/
│   ├── opencode-prompts.md       # Stage-based development prompts
│   └── 2026-04-17-zotero-ai-reader-design.md
├── zotero-plugin.config.ts       # Build config
├── package.json
└── tsconfig.json
```

## Implementation Status

### Completed
- [x] AI panel via ItemPaneManager.registerSection()
- [x] Menu registration (submenu structure with proper l10n)
- [x] Locale chrome registration in bootstrap.js
- [x] FTL resources loaded before menu registration
- [x] Correct attachment access (getAttachments + Zotero.Items.get)
- [x] SVG icons with context-fill/context-stroke
- [x] Shutdown cleanup (unregisterSection, unregisterEventListener, unregister prefs)
- [x] Fluent l10n for all UI strings (with addonRef prefix)
- [x] AI Skill system (6 skills with dedicated prompts)
- [x] **Built-in LLM client** (llm-client.ts - direct API calls to OpenAI/DeepSeek/Ollama)
- [x] **Built-in RAG engine** (rag-engine.ts - chunking + embedding + vector search + BM25)
- [x] PDF text extraction (attachment.attachmentText)
- [x] Reader text selection -> AI panel
- [x] Annotation manager (highlight with PDF.js coords + note fallback)
- [x] Quote locate button (findAndNavigateToText via PDF.js findController)
- [x] Preferences panel (provider, model, embedding model, language, auto-index, auto-highlight, colors)
- [x] Prefs wired into llm-client.ts and rag-engine.ts
- [x] Reader toolbar button (renderToolbar event, AI button)
- [x] **Menu text display fix** (5 critical bugs fixed)
- [x] **Tested in Zotero 9** - All features working

### Known Issues Fixed
1. ✅ Preferences showing two panels - Added registration guard
2. ✅ Menu items not showing text - Fixed 5 issues:
   - Menu structure (submenu vs menu)
   - FTL format (.label attribute)
   - Locale chrome registration
   - FTL loading timing (before registerMenu)
   - PreferencePanes API (not PrefsPane)

### Known Fragile Points
- `annotation-manager.ts`: Accessing `reader._iframeWindow.wrappedJSObject.PDFViewerApplication` is undocumented and may break across Zotero versions. The note annotation fallback ensures graceful degradation.
- `Zotero.Reader._readers`: Internal array, not part of public API.
- Toolbar button toggle: relies on DOM structure of Zotero's item pane which may change.

## Architecture - Built-in Mode (No Backend Required)

The plugin is fully self-contained with built-in LLM client and RAG engine:

### LLM Client (`src/modules/llm-client.ts`)
- Direct API calls to OpenAI-compatible endpoints
- Supports: OpenAI, DeepSeek, Ollama, LM Studio, Azure OpenAI
- Streaming response support
- Automatic provider-specific URL handling (Ollama uses `/api/chat`, others use `/v1/chat/completions`)

### RAG Engine (`src/modules/rag-engine.ts`)
- **Text Chunking**: Smart chunking with overlap, preserves context
- **Embedding**: Calls embedding API (OpenAI `/v1/embeddings`, Ollama `/api/embed`)
- **Vector Search**: Cosine similarity search in-memory
- **BM25 Fallback**: Keyword-based search when embedding fails
- **Storage**: IndexedDB-like storage in Zotero data directory

### No Python Backend Needed
All AI functionality runs directly in the plugin. Users only need:
1. An LLM API endpoint (Ollama local, or cloud API key)
2. Zotero 9

## Coding Guidelines

- Use `Zotero.debug("AI Reader: ...")` for all logging
- ALL registered listeners, sections, menus must be unregistered in `onShutdown()`
- Use Fluent (.ftl) for all user-facing strings
- Use standard HTML elements (not XUL) for custom section UI
- The plugin runs in a privileged Firefox/Gecko sandbox - `fetch`, `XMLHttpRequest`, `document`, `window` are available
- esbuild target is `firefox115` - modern JS is fine but no node-specific APIs
- Preferences use prefix `extensions.zotero-zoteroAIRreader.`

## AI Skills System

Each skill in `src/modules/skills/` implements the `AISkill` interface:
- `buildSystemPrompt(context)` - Returns a skill-specific system prompt with metadata
- `buildUserMessage(context)` - Returns the user message (handles selected text, custom queries)
- `parseResult(rawResponse)` - Extracts `[[QUOTE: "..."]]` markers from AI response

Skills are registered in `skills/index.ts` via the `ALL_SKILLS` array.

Color scheme:
- Summary: #ffd400 (yellow) | Concept: #5fb236 (green) | Argument: #2ea8e5 (blue)
- Quotes: #ff6666 (red) | Characters: #a28ae5 (purple) | Guide: #ff9500 (orange)

## Build & Test

```bash
npm install
npm run build        # Production build -> .scaffold/build/
npm start            # Dev with hot reload (needs .env with ZOTERO_PATH and ZOTERO_PROFILE)
```
