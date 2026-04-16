# Zotero AI 阅读助手插件设计

**日期：** 2026-04-17
**目标：** 开发 Zotero 插件，实现 AI 阅读助手功能

## 1. 概述

本插件为 Zotero 学术文献管理工具添加 AI 智能功能，帮助用户更好地阅读、理解和检索文献。

## 2. 架构设计

### 2.1 整体架构

采用 **插件 + 本地服务分离架构**：

```
┌─────────────────┐      ┌──────────────────────────┐
│  Zotero 插件    │ ──── │  本地 Python 服务         │
│  (TypeScript)   │ HTTP │  (FastAPI)               │
└─────────────────┘      └──────────────────────────┘
                                  │
                          ┌───────┴───────┐
                          │  FAISS 向量库  │
                          │  SQLite       │
                          └───────────────┘
```

### 2.2 组件职责

| 组件 | 技术 | 职责 |
|------|------|------|
| Zotero 插件 | TypeScript + Zotero Toolkit | UI、菜单、与用户交互 |
| 本地服务 | Python FastAPI | AI 调用、文本处理、向量计算 |
| 向量存储 | FAISS + SQLite | 文献向量索引、本地存储 |

## 3. 功能模块

### 3.1 AI 问答 (A)

- 选中 PDF 文献后，向 AI 提问
- AI 基于文献内容（chunk + RAG）回答
- 显示引用来源，标注【N】

**实现方式：**
- 右键菜单 "AI 问答"
- 打开侧边面板，输入问题
- 显示 AI 回答和引用列表

### 3.2 章节总结 (B)

- 对选中文献进行章节/全书总结
- 支持简洁/详细两种模式

**实现方式：**
- 右键菜单 "总结文献"
- 可选择特定章节
- 在弹窗/面板中显示总结

### 3.3 语义搜索 (C)

- 用自然语言搜索文献库
- 不再局限于关键词匹配
- 混合检索：向量搜索 + BM25

**实现方式：**
- 添加搜索工具栏按钮
- 弹出搜索面板，输入自然语言
- 返回相关文献片段和来源

### 3.4 笔记/高亮 AI 增强 (D)

- 对笔记和高亮内容进行 AI 分析
- 自动分类、提取关键词、生成摘要

**实现方式：**
- 选中高亮/笔记后右键菜单
- AI 分析并添加到笔记

## 4. AI 服务支持

### 4.1 支持的 LLM 服务

| 服务 | 配置方式 | 适用场景 |
|------|---------|---------|
| Ollama (本地) | `OLLAMA_BASE_URL=http://localhost:11434` | 完全免费离线 |
| LM Studio (本地) | `LMSTUDIO_BASE_URL=http://localhost:1234` | 完全免费离线，GUI友好 |
| DeepSeek API | `DEEPSEEK_API_KEY` | 性价比高 |
| OpenAI GPT | `OPENAI_API_KEY` | 效果好 |
| Claude API | `ANTHROPIC_API_KEY` | 长文本分析 |

**注意：** Ollama 和 LM Studio 均兼容 OpenAI API 格式，统一通过 `base_url` + `api_key` (固定值 `ollama` 或 `lm-studio`) 配置。

### 4.2 向量化选项

| 方式 | 配置 | 说明 |
|------|------|------|
| 本地 Embedding | Transformers.js | 完全离线，免费 |
| 云端向量化 | API 调用 | 需网络，处理快 |

## 5. 数据流

### 5.1 文献索引流程

```
用户选择文献 → 提取 PDF 文本 → 分块 (chunk) →
计算向量 (本地/云端) → 存储到 FAISS → 更新索引
```

### 5.2 问答流程

```
用户提问 → 检索相关 chunks → 构建 prompt →
调用 LLM → 返回回答 + 引用
```

## 6. 项目结构

```
zotero-ai-reader/
├── plugin/                    # Zotero 插件部分
│   ├── addon/
│   │   ├── manifest.json
│   │   ├── bootstrap.js
│   │   ├── content/
│   │   │   ├── ai-panel.xhtml    # AI 问答面板
│   │   │   └── styles.css
│   │   └── locale/
│   │       └── zh-CN/
│   ├── src/
│   │   ├── index.ts
│   │   ├── hooks.ts
│   │   ├── modules/
│   │   │   ├── ai-chat.ts       # AI 对话模块
│   │   │   ├── search.ts        # 语义搜索
│   │   │   └── api-client.ts    # 与后端通信
│   │   └── utils/
│   └── package.json
│
├── service/                   # Python 本地服务
│   ├── src/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── pdf_processor.py
│   │   ├── chunker.py
│   │   ├── vector_store.py
│   │   ├── rag_search.py
│   │   ├── llm.py
│   │   └── routes/
│   │       ├── chat.py
│   │       ├── index.py
│   │       └── search.py
│   ├── requirements.txt
│   └── .env.example
│
├── docs/                      # 设计文档
└── README.md
```

## 7. API 接口

### 7.1 索引接口

```
POST /api/index
Body: { "item_id": int }
Response: { "status": "indexing"|"done", "chunks": int }
```

### 7.2 问答接口

```
POST /api/chat
Body: { "item_id": int, "question": string, "use_rag": bool }
Response: { "answer": string, "citations": [...] }
```

### 7.3 总结接口

```
POST /api/summarize
Body: { "item_id": int, "chapter_index": int|null, "scope": "chapter"|"book" }
Response: { "summary": string }
```

### 7.4 搜索接口

```
GET /api/search?q=自然语言查询&limit=10
Response: { "results": [{ "content": string, "item_id": int, "score": float }] }
```

## 8. 技术栈

### 插件端
- TypeScript 5.9+
- Zotero Plugin Toolkit
- Zotero Types

### 服务端
- Python 3.11+
- FastAPI
- LangChain
- FAISS
- sentence-transformers (本地 embedding)

## 9. 开发环境

- **操作系统：** Windows
- **构建工具：** zotero-plugin-scaffold
- **包管理：** pnpm (插件) / pip (服务)

## 10. 后续计划

1. 实现基础插件框架和菜单
2. 开发 Python 后端服务
3. 实现 PDF 解析和向量化
4. 开发 AI 问答功能
5. 开发语义搜索功能
6. 开发笔记 AI 增强功能
7. 完善设置界面和国际化
