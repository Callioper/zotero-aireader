# OpenCode 提示词模板 - Zotero AI Reader

> 使用方法：每次开启 OpenCode 新对话时，从下面选择对应阶段的提示词，复制粘贴即可。
> AGENTS.md 会自动加载，不需要额外提供项目背景。

---

## 阶段 1：重写 AI 面板 UI（最优先）

```
当前 ai-chat.ts 使用 document.body.appendChild() 来展示 AI 面板，
这是错误的方式。请将其重写为使用 Zotero.ItemPaneManager.registerSection() API，
使 AI 面板显示在 PDF 阅读器的右侧 item pane 中。

具体要求：
1. 创建新模块 src/modules/ai-panel.ts，封装 AIPanel 类
2. 在 hooks.ts 的 onStartup 中调用 aiPanel.register()
3. paneID 为 "zotero-ai-reader-panel"
4. onItemChange 中：当 tabType === "reader" 或 item 有 PDF 附件时启用面板
5. onRender 中：构建聊天 UI，包含：
   - 顶部：技能按钮栏（智能摘要、概念解释、论证分析、人物追踪、金句收藏、阅读向导）
   - 中间：消息显示区域（可滚动，支持简单 Markdown 渲染）
   - 底部：文本输入框 + 发送按钮
6. 使用标准 HTML 元素（不要用 XUL）
7. onAsyncRender 中：自动调用后端 indexItem 建立索引
8. 保存 registerSection 返回的 ID，在 onShutdown 时调用 unregisterSection 清理
9. 在 zh-CN/addon.ftl 和 en-US/addon.ftl 中添加对应的 l10n 字符串
10. 添加 addon/content/ai-panel.css 样式文件
11. 保持与 api-client.ts 的集成（chat、indexItem 方法）

请参考 AGENTS.md 中的 ItemPaneManager API 文档。
```

---

## 阶段 2：修复菜单和附件访问

```
hooks.ts 中有几个问题需要修复：

1. 附件获取方式错误（hooks.ts:158-169）：
   - 错误写法: item.attachments[0].filePath
   - 正确写法: 
     const attachmentIDs = item.getAttachments();
     for (const id of attachmentIDs) {
       const att = Zotero.Items.get(id);
       if (att.isPDFAttachment()) {
         const path = att.getFilePath();
       }
     }

2. registerMenu 目前只注册了一个 "Test" 按钮（hooks.ts:121-132），
   需要改为完整的 AI Reader 子菜单：
   - AI 问答 → 调用 onAIChat
   - 总结文献 → 调用 onSummarize  
   - 语义搜索 → 调用 onSearch
   使用 Zotero.MenuManager.registerMenu() 注册包含子菜单的 menu

3. 确保 onAIChat、onSummarize、onSearch 三个函数正确连接到菜单的 onCommand

4. 修复所有函数中的附件获取逻辑，使用正确的 Zotero API

请参考 AGENTS.md 中的 Menu Registration 和 Known Issues 部分。
```

---

## 阶段 3：AI 技能系统

```
在 src/modules/ 下创建 AI 技能系统。当前项目已有 api-client.ts 与后端通信。

请创建以下文件：

1. src/modules/skills/types.ts - 技能接口定义：
   interface AISkill {
     id: string;
     name: string;
     icon: string;
     description: string;
     color: string;  // 高亮注释颜色
     buildPrompt(context: SkillContext): string;
     parseResult(result: string): SkillResult;
   }
   interface SkillContext { fullText: string; selectedText?: string; itemMetadata: any; }
   interface SkillResult { content: string; quotes: string[]; }

2. src/modules/skills/summary.ts - 智能摘要：
   - System prompt：分析文献，生成结构化摘要（核心论点、章节摘要、关键信息）
   - 要求 AI 用 [[QUOTE: "原文"]] 标记引用

3. src/modules/skills/concept-explain.ts - 概念解释：
   - 针对选中文本或指定术语深入解释
   - 包含：定义、上下文含义、相关概念、通俗解释

4. src/modules/skills/argument-analysis.ts - 论证分析：
   - 分析论证结构：主张、论据、推理方式、强度、漏洞

5. src/modules/skills/quote-collector.ts - 金句收藏：
   - 发现精彩语句，每条必须有 [[QUOTE: "..."]] 标记

6. src/modules/skills/reading-guide.ts - 阅读向导：
   - 提供阅读建议、思考问题、讨论话题

7. src/modules/skills/index.ts - 技能注册中心：
   - 导出所有技能的数组
   - 提供 getSkillById(id) 方法

所有 prompt 使用中文，学术场景优化。
每个技能的 buildPrompt 接受上下文，返回完整的 system + user prompt。
parseResult 从 AI 回复中提取 [[QUOTE: "..."]] 标记。
```

---

## 阶段 4：PDF 文本提取和选中文本

```
创建 src/modules/pdf-text.ts，处理 PDF 文本获取和用户选中文本。

1. 获取 PDF 全文：
   async function getFullText(item: Zotero.Item): Promise<string>
   - 通过 item.getAttachments() 找到 PDF attachment
   - 用 attachment.attachmentText 获取全文

2. 注册 Reader 选中文本事件：
   function registerTextSelectionListener()
   - 使用 Zotero.Reader.registerEventListener("renderTextSelectionPopup", handler, pluginID)
   - 在选中文本弹出框中添加 "AI 分析" 按钮
   - 点击后将选中文本发送到 AI 面板
   - 获取 params.annotation.text 和位置信息

3. 在 hooks.ts 的 onStartup 中调用 registerTextSelectionListener()
4. 在 onShutdown 中 unregister

请参考 AGENTS.md 中的 Reader UI Injection API。
```

---

## 阶段 5：高亮标注系统

```
创建 src/modules/annotation-manager.ts，将 AI 提取的引用转换为 PDF 高亮标注。

这是最核心也最难的功能，请按以下步骤实现：

1. 解析 AI 回复中的 [[QUOTE: "原文文本"]] 标记：
   function parseQuotes(text: string): string[]

2. 在 PDF 全文中匹配引用文本的位置：
   - 用 attachment.attachmentText 获取全文
   - 字符串搜索匹配

3. 尝试获取文本的精确 PDF 坐标：
   方案A（优先）：通过 Zotero Reader 内部的 PDF.js
   - 访问 reader._iframeWindow
   - 使用 PDFViewerApplication.findController 搜索文本
   - 提取匹配文本的 rects 坐标
   
   方案B（降级）：如果无法获取精确坐标
   - 创建 note 类型标注而非 highlight
   - 在 annotationComment 中记录引用内容

4. 创建 Zotero Annotation：
   const annotation = new Zotero.Item("annotation");
   annotation.parentID = attachmentItemID;
   annotation.annotationType = "highlight"; // 或 "note"
   annotation.annotationText = quotedText;
   annotation.annotationComment = "AI 分析备注";
   annotation.annotationColor = skill.color; // 不同技能不同颜色
   annotation.annotationPosition = JSON.stringify(positionData);
   annotation.addTag("AI-Generated");
   await annotation.saveTx();

5. 颜色方案：
   - 摘要: #ffd400 (黄) | 概念: #5fb236 (绿) | 论证: #2ea8e5 (蓝)
   - 金句: #ff6666 (红) | 人物: #a28ae5 (紫) | 向导: #ff9500 (橙)

6. 在 AI 面板中的引用文本旁添加 [定位] 按钮，点击跳转到对应页面

请先研究方案A的可行性，不可行再用方案B。
参考 AGENTS.md 中的 Creating Highlight Annotations API。
```

---

## 阶段 6：偏好设置面板

```
更新偏好设置面板 addon/content/preferences.xhtml，添加完整的配置项。

当前的 preferences.xhtml 只有启用开关和 API URL，需要扩展为：

1. AI 服务配置：
   - API Endpoint (文本输入，默认 http://127.0.0.1:8765/api)
   - LLM Provider 选择 (下拉：Ollama/LM Studio/DeepSeek/OpenAI/Claude)
   - Model 名称 (文本输入)

2. 功能配置：
   - 默认语言 (下拉：中文/English)
   - 自动索引开关 (打开 PDF 时自动建立索引)
   - 对话历史保留轮数 (数字输入)

3. 高亮标注配置：
   - 自动高亮开关
   - 各技能的高亮颜色选择

同时更新：
- addon/prefs.js 添加对应的默认值
- locale .ftl 文件添加所有设置项的 l10n 字符串
- src/utils/prefs.ts 添加新的偏好读取方法
```

---

## 阶段 7：Reader 工具栏按钮

```
在 PDF 阅读器顶部工具栏添加 AI Reader 按钮。

使用 Zotero.Reader.registerEventListener("renderToolbar", handler, pluginID) 注册。

要求：
1. 在工具栏添加一个 "AI" 图标按钮
2. 点击后展开/折叠右侧的 AI 面板 section
3. 可选：按钮旁添加下拉菜单快速选择技能

参考 AGENTS.md 中的 Reader UI Injection API。
```

---

## 调试用提示词

### 构建失败时

```
npm run build 报错，错误信息如下：
[粘贴错误信息]

请分析错误原因并修复。注意：
- esbuild target 是 firefox115
- 不能使用 Node.js 特有 API（fs, path 等）
- Zotero API 类型来自 zotero-types 包
```

### 运行时错误

```
插件在 Zotero 中运行时出错，Debug Output 显示：
[粘贴 Zotero debug 输出]

请分析错误原因并修复。查看 Zotero 调试指南：zotero调试指南.md
```

### 菜单不显示

```
插件安装后右键菜单不显示 AI Reader 选项。
请检查：
1. registerMenu 是否在 onStartup 中被调用
2. menuID 是否正确
3. target 格式是否正确（应为 "main/library/item"）
4. bootstrap.js 是否正确加载了 bundled JS
```

---

## 通用规则（每次提问时可附加）

```
完成后请：
1. 确认所有新增的 event listener / section 在 onShutdown 时正确清理
2. 确认代码没有使用 Zotero 不支持的 Web API 或 Node.js API
3. 确认 locale .ftl 文件包含所有新增的 l10n 字符串
4. 列出可能的 edge case
5. 确认 npm run build 能通过编译
```
