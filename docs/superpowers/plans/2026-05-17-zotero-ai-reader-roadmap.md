# Zotero AI Reader - Implementation Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a production-quality Zotero 9 plugin that provides AI-powered PDF reading assistance with 6 skills, RAG search, and annotation highlighting.

**Architecture:** Pure built-in mode. The plugin directly calls OpenAI-compatible LLM APIs. No Python backend required. RAG engine runs in-process with in-memory vector store and BM25 fallback.

**Tech Stack:** TypeScript + esbuild (firefox115), Zotero 9 ItemPaneManager/Reader/MenuManager APIs, Fluent FTW for l10n.

---

## Current Status (v0.4-dev)

### Done
- [x] Plugin bootstrap (chrome registration, lifecycle hooks)
- [x] Menu registration with correct MenuManager API (submenu + l10n)
- [x] Right sidebar AI panel via ItemPaneManager.registerSection()
- [x] Preferences panel with LLM provider/model/API key config
- [x] Built-in LLM client (OpenAI/DeepSeek/Ollama, chat + embedding)
- [x] Built-in RAG engine (chunking, embedding, cosine search, BM25 fallback)
- [x] 6 AI skill definitions (types, prompts, result parsing)
- [x] PDF text extraction (attachment.attachmentText) and metadata extraction
- [x] Annotation manager (highlight + note annotation creation)
- [x] Quote-to-PDF navigation (PDF.js findController)
- [x] Reader text selection popup ("AI 分析选中文本")
- [x] Reader toolbar button (AI toggle)
- [x] FTL localization for 92 keys (en-US, zh-CN)
- [x] GitHub Actions CI/CD (tag → build → release)
- [x] Codebase cleanup (dead files, duplicate code, unused exports removed)

### Known Gaps
- [ ] Menu items confirmed working in Zotero (pending user test)
- [ ] Streaming LLM responses not surfaced to UI
- [ ] Conversation history not persisted across sessions
- [ ] RAG indexing not triggered automatically when PDF opens
- [ ] No error/empty states for each UI section
- [ ] Preferences panel "Test Connection" buttons need wiring to health checks
- [ ] Code needs `@ts-ignore` for Zotero global typings
- [ ] service/ directory is legacy (Python backend, no longer needed)

---

## Phase 1: UX Completion (v0.5)

Goal: All UI flows work end-to-end. The plugin feels like a real product, not a prototype.

### Task 1: Wire Preferences "Test Connection" Buttons

**Files:**
- Modify: `addon/content/preferences.js:1-89`

**What:** Connect the existing "Test Chat" and "Test Embedding" buttons to the `llmChatHealthCheck` and `llmEmbedHealthCheck` functions exposed via `Zotero.ZoteroAIRreader.api`.

- [ ] **Step 1: Add click handlers to preferences.js that call `Zotero.ZoteroAIRreader.api.llmChatHealthCheck()` and `llmEmbedHealthCheck()`**

```javascript
// In preferences.js, before the closing script tag:
document.getElementById("test-chat-btn")?.addEventListener("click", async () => {
  const status = document.getElementById("test-chat-status");
  status.textContent = "Testing...";
  try {
    await Zotero.ZoteroAIRreader.api.llmChatHealthCheck();
    status.textContent = "Connected";
    status.style.color = "green";
  } catch (e) {
    status.textContent = "Failed: " + e.message;
    status.style.color = "red";
  }
});

document.getElementById("test-embed-btn")?.addEventListener("click", async () => {
  const status = document.getElementById("test-embed-status");
  status.textContent = "Testing...";
  try {
    await Zotero.ZoteroAIRreader.api.llmEmbedHealthCheck();
    status.textContent = "Connected";
    status.style.color = "green";
  } catch (e) {
    status.textContent = "Failed: " + e.message;
    status.style.color = "red";
  }
});
```

- [ ] **Step 2: Verify preferences.xhtml has matching `id` attributes on the test buttons and status spans**

Run: `grep "test-chat" addon/content/preferences.xhtml` - expected: find matching elements.

- [ ] **Step 3: Build and test**

```bash
cd D:\opencode\ai-reader-zotero-plugin
npx esbuild src/index.ts --bundle --format=iife --target=firefox115 \
  --outfile=.scaffold/build/addon/content/scripts/zoteroAIRreader.js \
  --define:__env='"production"' --global-name=_globalThis
```

- [ ] **Step 4: Commit**

```bash
git add addon/content/preferences.js addon/content/preferences.xhtml
git commit -m "feat: wire preferences test connection buttons to health checks"
```

### Task 2: Error / Empty States in AI Panel

**Files:**
- Modify: `src/modules/ai-panel.ts:60-120` (onRender area, setup guide)
- Modify: `src/modules/ai-panel.ts:95-130` (onItemChange area)
- Modify: `addon/locale/en-US/addon.ftl` (add new strings)
- Modify: `addon/locale/zh-CN/addon.ftl` (add new strings)

**What:** Show appropriate messages when: (a) no item selected, (b) item is not a PDF/regular item, (c) LLM not configured, (d) embedding fails, (e) no PDF text extracted.

- [ ] **Step 1: Add FTL strings for each empty state**

```ftl
# addon/locale/en-US/addon.ftl (append at end)
zotero-air-reader-empty-no-item = Select a PDF or library item to use AI Assistant
zotero-air-reader-empty-not-configured = Configure LLM in Preferences to get started
zotero-air-reader-empty-no-text = Could not extract text from this PDF
zotero-air-reader-error-embed = Embedding failed for some chunks. Results may be incomplete.
zotero-air-reader-loading-text = Extracting text...
zotero-air-reader-loading-index = Indexing document...
```

```ftl
# addon/locale/zh-CN/addon.ftl (append at end)
zotero-air-reader-empty-no-item = 选择一个 PDF 或文献条目以使用 AI 助手
zotero-air-reader-empty-not-configured = 在首选项中配置 LLM 以开始使用
zotero-air-reader-empty-no-text = 无法从此 PDF 提取文本
zotero-air-reader-error-embed = 部分段落嵌入失败，结果可能不完整
zotero-air-reader-loading-text = 正在提取文本...
zotero-air-reader-loading-index = 正在索引文档...
```

- [ ] **Step 2: Add `showEmptyState(messageKey)` helper to AiPanel class**

```typescript
// In src/modules/ai-panel.ts, inside the AiPanel class:
private showEmptyState(l10nKey: string) {
  const pane = this.pane;
  if (!pane) return;
  pane.messages.innerHTML = "";
  const div = document.createElement("div");
  div.className = "ai-empty-state";
  div.textContent = pane.doc.l10n?.formatValue(l10nKey) || l10nKey;
  pane.messages.appendChild(div);
}
```

- [ ] **Step 3: Integrate into onRender to check conditions**

In `onRender({ doc, body, item })`:
- If no item → show "empty-no-item"
- If LLM not configured → show "empty-not-configured"
- If embedding is enabled but failed → show "error-embed" banner

```typescript
onRender: ({ doc, body, item }) => {
  if (!item) {
    this.showEmptyState("zotero-air-reader-empty-no-item");
    return;
  }
  if (!isChatConfigured()) {
    this.showEmptyState("zotero-air-reader-empty-not-configured");
    return;
  }
  // ... existing render logic
},
```

- [ ] **Step 4: Add CSS for empty state styling**

```css
/* addon/content/ai-panel.css (append) */
.ai-empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 24px;
  color: var(--fill-secondary, #666);
  font-size: 14px;
  text-align: center;
}
```

- [ ] **Step 5: Build and commit**

```bash
git add src/modules/ai-panel.ts addon/locale/en-US/addon.ftl addon/locale/zh-CN/addon.ftl addon/content/ai-panel.css
git commit -m "feat: add error/empty states with localization"
```

### Task 3: Auto-Index PDF on Open

**Files:**
- Modify: `src/modules/ai-panel.ts:240-310` (onAsyncRender area)
- Modify: `src/modules/rag-engine.ts` (expose `isIndexed(itemId)` check)

**What:** When a PDF is opened and auto-index is enabled in prefs, automatically extract text + build RAG index. Show indexing progress.

- [ ] **Step 1: Add `isIndexed(itemId)` method to RAGEngine**

```typescript
// In src/modules/rag-engine.ts, inside RagEngine class:
public isIndexed(itemId: number): boolean {
  return this.indexedItems.has(itemId);
}
```

- [ ] **Step 2: Modify onAsyncRender to trigger auto-indexing**

```typescript
// In src/modules/ai-panel.ts, onAsyncRender handler:
onAsyncRender: async ({ body, item }) => {
  if (!item || !isAutoIndex()) return;

  const itemId = item.id;
  if (ragEngine.isIndexed(itemId)) return;

  this.showStatus(body, "\u23F3 Indexing document...");

  const conv = this.getConversation(itemId);
  const fullText = conv.fullText;
  if (!fullText) {
    this.showStatus(body, "Cannot index: no text extracted");
    return;
  }

  try {
    await ragEngine.indexDocument(itemId, fullText);
    this.showStatus(body, `\u2705 Indexed ${ragEngine.getChunkCount(itemId)} chunks`);
    setTimeout(() => this.clearStatus(body), 3000);
  } catch (e) {
    this.showStatus(body, `\u26A0\uFE0F Indexing failed: ${e}`);
  }
},
```

- [ ] **Step 3: Build and commit**

```bash
git add src/modules/rag-engine.ts src/modules/ai-panel.ts
git commit -m "feat: auto-index PDF on open when auto-index enabled"
```

---

## Phase 2: Polish & Performance (v0.6)

Goal: Smooth UX, persistent state, production-ready reliability.

### Task 4: Conversation History Persistence

**Files:**
- Create: `src/modules/conversation-store.ts`
- Modify: `src/modules/ai-panel.ts:130-180` (Conversation management)

**What:** Save conversation history to Zotero data directory so it survives plugin reload and Zotero restart.

- [ ] **Step 1: Create ConversationStore**

```typescript
// src/modules/conversation-store.ts
import { config } from "../../package.json";

interface StoredConversation {
  itemId: number;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  metadata: any;
  updatedAt: number;
}

export class ConversationStore {
  private baseDir: string;

  constructor() {
    this.baseDir = Zotero.DataDirectory ?? OS.Constants.Path.profileDir;
  }

  private getPath(itemId: number): string {
    return `${this.baseDir}/ai-reader-conversations/${itemId}.json`;
  }

  save(itemId: number, messages: any[], metadata: any): void {
    const dir = `${this.baseDir}/ai-reader-conversations`;
    // Create dir if not exists using Zotero.File
    Zotero.File.createDirectoryIfMissing(dir);

    const data: StoredConversation = {
      itemId,
      messages,
      metadata,
      updatedAt: Date.now(),
    };
    Zotero.File.putContents(this.getPath(itemId), JSON.stringify(data));
  }

  load(itemId: number): StoredConversation | null {
    try {
      const raw = Zotero.File.getContents(this.getPath(itemId));
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  delete(itemId: number): void {
    try {
      Zotero.File.removeFile(this.getPath(itemId));
    } catch { /* ignore */ }
  }
}

export const conversationStore = new ConversationStore();
```

- [ ] **Step 2: Integrate into AiPanel - save after each AI response**

```typescript
// In ai-panel.ts, after appending assistant message:
const conv = this.getConversation(itemId);
conversationStore.save(itemId, conv.messages, conv.metadata);
```

- [ ] **Step 3: Load persisted conversations on startup**

```typescript
// In ai-panel.ts, add method:
private loadConversation(itemId: number): void {
  const saved = conversationStore.load(itemId);
  if (saved && saved.messages.length > 0) {
    const conv = this.getConversation(itemId);
    conv.messages = saved.messages;
    conv.metadata = saved.metadata;
    this.renderMessages(this.pane!);
  }
}

// Call in onRender when item changes
```

- [ ] **Step 4: Configure gitignore for conversation storage**

```bash
echo "ai-reader-conversations/" >> .gitignore
git add .gitignore src/modules/conversation-store.ts src/modules/ai-panel.ts
git commit -m "feat: persist conversation history to disk"
```

### Task 5: Streaming Response Rendering

**Files:**
- Modify: `src/modules/llm-client.ts:145-210` (llmChat with streaming)
- Modify: `src/modules/ai-panel.ts:530-600` (sendMessage area)

**What:** Show AI response tokens as they arrive (streaming), rather than waiting for the full response.

- [ ] **Step 1: Add streaming support to llmChat**

```typescript
// In src/modules/llm-client.ts, add streaming variant:
export async function llmChatStream(
  messages: LLMMessage[],
  onToken: (token: string) => void,
  configOverride?: Partial<LLMConfig>,
): Promise<string> {
  const { baseUrl, apiKey, model, provider } = { ...getConfig(), ...configOverride };
  const messagesPayload = messages.map(m => ({ role: m.role, content: m.content }));

  const url = provider === "ollama"
    ? `${baseUrl}/api/chat`
    : `${baseUrl}/v1/chat/completions`;

  const body: Record<string, any> = {
    model,
    messages: messagesPayload,
    stream: true,
  };

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`LLM API error ${response.status}: ${await response.text()}`);
  }

  let fullText = "";
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n").filter(l => l.startsWith("data: "));

    for (const line of lines) {
      const json = line.slice(6).trim();
      if (json === "[DONE]") continue;

      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content;
        if (parsed.message?.content) {
          // Ollama non-streaming fallback
          fullText += parsed.message.content;
          onToken(parsed.message.content);
        } else if (content) {
          fullText += content;
          onToken(content);
        }
      } catch { /* skip malformed chunks */ }
    }
  }

  return fullText;
}
```

- [ ] **Step 2: Modify ai-panel.ts to use streaming**

```typescript
// Replace llmChat() with llmChatStream() in the skill handler:

// Create a pending message bubble
const msgEl = this.appendMessageBubble("assistant", "");
const textNode = msgEl.querySelector(".ai-message-text");

let streamed = "";
const fullResponse = await llmChatStream(chatMessages, (token) => {
  streamed += token;
  if (textNode) textNode.textContent = streamed;
  this.scrollToBottom();
});
```

- [ ] **Step 3: Build and commit**

```bash
git add src/modules/llm-client.ts src/modules/ai-panel.ts
git commit -m "feat: streaming LLM responses with progressive rendering"
```

---

## Phase 3: Release (v1.0)

Goal: Public release on GitHub with working CI/CD and documentation.

### Task 6: Clean Up Legacy Python Backend

**Files:**
- Remove: `service/` directory
- Modify: `README.md` (remove Python backend references)
- Modify: `docs/2026-04-17-zotero-ai-reader-design.md` (update architecture)

- [ ] **Step 1: Remove service/ directory**

```bash
git rm -r service/
```

- [ ] **Step 2: Update README architecture section**

Replace "插件 + 本地服务分离架构" references with "纯内置模式" description.

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: remove legacy Python backend, update docs to reflect built-in mode"
```

### Task 7: Version Bump and Release

**Files:**
- Modify: `package.json` (version to 1.0.0)

- [ ] **Step 1: Update version in package.json**

```json
"version": "1.0.0"
```

- [ ] **Step 2: Commit, tag, push**

```bash
git add package.json
git commit -m "release: v1.0.0"
git tag v1.0.0
git push origin main --tags
```

---

## Phase 4: Post-1.0 (v1.1+)

Features for future iterations:

### v1.1: Multi-Document RAG
- Index multiple PDFs and search across them
- Cross-document Q&A ("Compare the methodology in Paper A vs Paper B")

### v1.2: Enhanced Note Integration
- Append AI analysis to Zotero notes
- Auto-categorize AI-generated notes
- Two-way sync between AI panel and note editor

### v1.3: Advanced RAG
- Hybrid search weighting (vector + BM25 tunable ratio)
- Re-ranking of search results
- Citation-aware chunking (respects section boundaries)

### v1.4: Reader Deep Integration
- Inline AI suggestions while reading
- Floating AI button on text selection (faster than panel)
- Sentence-level translation overlay

---

## File Map (Current)

```
D:\opencode\ai-reader-zotero-plugin\
├── src/
│   ├── index.ts                     # Entry point (10 lines)
│   ├── addon.ts                     # Addon singleton class (26 lines)
│   ├── hooks.ts                     # Lifecycle: startup/shutdown/menu/prefs/reader (343 lines)
│   ├── utils/
│   │   └── prefs.ts                 # Preference getters/setters (57 lines)
│   └── modules/
│       ├── ai-panel.ts              # Main AI panel, ItemPaneManager section (735 lines)
│       ├── llm-client.ts            # OpenAI-compatible chat/embedding client (348 lines)
│       ├── rag-engine.ts            # In-process RAG engine (328 lines)
│       ├── pdf-text.ts              # PDF text and metadata extraction (132 lines)
│       ├── annotation-manager.ts    # Highlight/note annotation creation (355 lines)
│       └── skills/
│           ├── types.ts             # AISkill, SkillContext, SkillResult interfaces
│           ├── index.ts             # ALL_SKILLS registry + getSkillById()
│           ├── summary.ts           # Smart Summary skill
│           ├── concept-explain.ts   # Concept Explanation skill
│           ├── argument-analysis.ts # Argument Analysis skill
│           ├── character-tracking.ts# Character/Entity Tracking skill
│           ├── quote-collector.ts   # Quote Collection skill
│           └── reading-guide.ts     # Reading Guide skill
├── addon/
│   ├── manifest.json                # Plugin manifest
│   ├── bootstrap.js                 # Firefox bootstrap lifecycle
│   ├── prefs.js                     # Default preferences
│   ├── content/
│   │   ├── preferences.xhtml        # Preferences UI
│   │   ├── preferences.js           # Preference event handlers
│   │   ├── ai-panel.css             # AI panel stylesheet (234 lines)
│   │   └── icons/ (icon16.svg, icon20.svg, icon48.svg)
│   └── locale/
│       ├── en-US/addon.ftl          # English (92 keys)
│       └── zh-CN/addon.ftl          # Chinese (92 keys)
├── typings/                         # TypeScript declarations
├── docs/
│   ├── superpowers/plans/           # Implementation plans
│   ├── 2026-04-17-zotero-ai-reader-design.md
│   ├── implementation-plan.md       # (OUTDATED - Python backend era)
│   └── opencode-prompts.md
├── .github/workflows/release.yml    # CI/CD pipeline
├── zotero-plugin.config.ts          # Build configuration
├── package.json                     # NPM + plugin metadata
├── tsconfig.json
└── AGENTS.md                        # AI agent development guide
```

---

## Key APIs Used

| API | Purpose | Location |
|-----|---------|----------|
| `Zotero.ItemPaneManager.registerSection()` | Right sidebar AI panel | hooks.ts:35 |
| `Zotero.MenuManager.registerMenu()` | Right-click context menu | hooks.ts:173 |
| `Zotero.PreferencePanes.register()` | Settings panel | hooks.ts:146 |
| `Zotero.Reader.registerEventListener("renderTextSelectionPopup")` | Selected text popup | hooks.ts:278 |
| `Zotero.Reader.registerEventListener("renderToolbar")` | Toolbar AI button | hooks.ts:284 |
| `Zotero.Prefs.get()/set()` | Plugin preferences | prefs.ts:10 |
| `attachment.attachmentText` | PDF full text extraction | pdf-text.ts:24 |
| `document.l10n.addResourceIds()` | FTL localization loading | hooks.ts:25,96 |

---

## Build Commands

```bash
# Development build
cd D:\opencode\ai-reader-zotero-plugin
npx esbuild src/index.ts --bundle --format=iife --target=firefox115 \
  --outfile=.scaffold/build/addon/content/scripts/zoteroAIRreader.js \
  --define:__env='"production"' --global-name=_globalThis

# Type check
npx tsc --noEmit

# Create XPI for local testing
powershell -Command "
  Copy-Item addon\manifest.json .scaffold\build\addon\manifest.json -Force;
  Copy-Item -Recurse addon\content .scaffold\build\addon\content -Force;
  Copy-Item -Recurse addon\locale .scaffold\build\addon\locale -Force;
  Copy-Item addon\bootstrap.js .scaffold\build\addon\bootstrap.js -Force;
  Copy-Item addon\prefs.js .scaffold\build\addon\prefs.js -Force;
  Compress-Archive -Path .scaffold\build\addon\* -DestinationPath zotero-ai-reader.zip -Force;
  Rename-Item zotero-ai-reader.zip zotero-ai-reader.xpi -Force
"
```
