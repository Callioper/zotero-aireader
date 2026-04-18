# Zotero AI Reader

一个为 Zotero 9 设计的 AI 阅读助手插件，提供智能文献分析、概念解释、论证分析等功能。

## ✨ 功能特性

### 🤖 六大 AI 技能

- **智能摘要** - 生成文献结构化摘要，提取核心论点和关键信息
- **概念解释** - 深入解释文中的专业术语和抽象概念
- **论证分析** - 分析论证结构、证据强度和逻辑漏洞
- **人物追踪** - 提取文中人物和机构，分析关系网络
- **金句收藏** - 发现并收藏文中精彩语句和名言
- **阅读向导** - 提供阅读建议、思考问题和讨论话题

### 🎯 核心功能

- **右侧边栏 AI 面板** - 在 PDF 阅读器右侧提供 AI 对话界面
- **智能引用标注** - AI 生成的引用自动转为 PDF 高亮标注，支持点击跳转原文
- **纯内置模式** - 插件直接调用 LLM API，内嵌 RAG 向量搜索，无需 Python 后端
- **多模型支持** - 支持 OpenAI、DeepSeek、Ollama、LM Studio 等多种 LLM 提供商
- **本地优先** - 支持 Ollama 本地模型，保护数据隐私

## 📦 安装

### 方法 1：从 Release 下载（推荐）

1. 前往 [Releases](https://github.com/Callioper/zotero-aireader/releases) 页面
2. 下载最新版本的 `zotero-ai-reader.xpi`
3. 打开 Zotero 9，进入 `工具` → `插件`
4. 点击右上角齿轮图标 → `Install Add-on From File...`
5. 选择下载的 `.xpi` 文件

### 方法 2：从源码构建

```bash
git clone https://github.com/Callioper/zotero-aireader.git
cd zotero-aireader
npm install
npm run build
```

构建产物位于 `.scaffold/build/zotero-ai-reader.xpi`

## 🚀 快速开始

### 1. 配置 LLM 服务

安装插件后，进入 `编辑` → `首选项` → `AI Reader`：

#### 使用 Ollama（本地，推荐）

1. 安装 [Ollama](https://ollama.ai/)
2. 拉取模型：
   ```bash
   ollama pull qwen2.5:7b
   ollama pull nomic-embed-text
   ```
3. 在插件设置中：
   - **LLM 提供商**：选择 `Ollama (local)`
   - **API 地址**：留空（默认 `http://127.0.0.1:11434`）
   - **对话模型**：`qwen2.5:7b`
   - **Embedding 模型**：`nomic-embed-text`

#### 使用 DeepSeek（在线）

1. 获取 API Key：[DeepSeek Platform](https://platform.deepseek.com/)
2. 在插件设置中：
   - **LLM 提供商**：选择 `DeepSeek`
   - **API 密钥**：填入你的 API Key
   - **对话模型**：`deepseek-chat`
   - **Embedding 模型**：`deepseek-chat`（DeepSeek 暂无专用 embedding 模型）

#### 使用 OpenAI

1. 获取 API Key：[OpenAI Platform](https://platform.openai.com/)
2. 在插件设置中：
   - **LLM 提供商**：选择 `OpenAI`
   - **API 密钥**：填入你的 API Key
   - **对话模型**：`gpt-4o-mini`
   - **Embedding 模型**：`text-embedding-3-small`

### 2. 使用 AI 阅读助手

#### 方式 1：右侧边栏面板

1. 在 Zotero 中打开一个 PDF 文件
2. 点击右侧边栏的 **AI 助手** 标签
3. 选择一个 AI 技能（如"智能摘要"）
4. 点击"开始分析"或直接输入问题

#### 方式 2：右键菜单

1. 在文献列表中右键点击一个条目
2. 选择 `AI Reader` → `AI 问答` / `总结文献` / `语义搜索`

#### 方式 3：PDF 阅读器工具栏

1. 打开 PDF 后，点击工具栏的 **AI** 按钮
2. 在弹出的面板中与 AI 对话

## 🎨 功能详解

### 智能标注

AI 回复中的引用会自动转换为 PDF 高亮标注：

- **格式**：`[[QUOTE: "引用文本"]]`
- **颜色**：不同技能使用不同颜色（可在设置中自定义）
  - 摘要：黄色 `#ffd400`
  - 概念：绿色 `#5fb236`
  - 论证：蓝色 `#2ea8e5`
  - 人物：紫色 `#a28ae5`
  - 金句：红色 `#ff6666`
  - 向导：橙色 `#ff9500`

### RAG 向量搜索

插件内置 RAG 引擎，自动为 PDF 建立索引：

- **自动索引**：打开 PDF 时自动建立索引（可在设置中关闭）
- **分块策略**：智能分块，保留上下文
- **混合检索**：Embedding 向量搜索 + BM25 关键词搜索
- **本地存储**：索引存储在 Zotero 数据目录

## ⚙️ 高级配置

### 自定义 API 地址

对于 OpenAI 兼容的 API（如 Azure OpenAI、本地部署的模型）：

1. **LLM 提供商**：选择 `OpenAI Compatible`
2. **API 地址**：填入完整的 API 端点（如 `https://your-api.com/v1`）
3. **API 密钥**：填入对应的密钥
4. **对话模型**：填入模型名称

### 对话历史

- **保留轮数**：设置对话历史保留的轮数（默认 10 轮）
- 历史记录用于保持上下文连贯性

### 语言设置

- **默认语言**：选择 AI 回复的默认语言（中文/English）
- 也可以在对话中用自然语言切换（如"请用英文回答"）

## 🛠️ 开发

### 环境要求

- Node.js 18+
- npm 或 pnpm
- Zotero 9 Beta

### 开发模式

```bash
# 安装依赖
npm install

# 开发模式（热重载）
npm start

# 构建生产版本
npm run build

# 发布新版本
npm run release
```

### 项目结构

```
zotero-ai-reader/
├── src/
│   ├── modules/
│   │   ├── ai-panel.ts          # AI 面板主逻辑
│   │   ├── llm-client.ts        # LLM API 客户端
│   │   ├── rag-engine.ts        # RAG 向量搜索引擎
│   │   ├── annotation-manager.ts # 标注管理
│   │   ├── pdf-text.ts          # PDF 文本提取
│   │   └── skills/              # AI 技能模块
│   ├── hooks.ts                 # 插件生命周期钩子
│   └── index.ts                 # 入口文件
├── addon/
│   ├── content/
│   │   ├── preferences.xhtml    # 偏好设置界面
│   │   └── ai-panel.css         # 样式文件
│   ├── locale/                  # 国际化文件
│   ├── bootstrap.js             # 引导脚本
│   └── prefs.js                 # 默认配置
└── package.json
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 开发指南

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m 'Add amazing feature'`
4. 推送到分支：`git push origin feature/amazing-feature`
5. 提交 Pull Request

### 添加新的 AI 技能

参考 `src/modules/skills/` 目录下的现有技能模块，实现 `AISkill` 接口：

```typescript
export interface AISkill {
  id: string;
  name: string;
  description: string;
  color: string;
  buildSystemPrompt(context: SkillContext): string;
  buildUserMessage(context: SkillContext): string;
  parseResult(rawResponse: string): ParsedResult;
}
```

## 📄 许可证

[AGPL-3.0](LICENSE)

## 🙏 致谢

- [Zotero](https://www.zotero.org/) - 开源文献管理工具
- [zotero-plugin-scaffold](https://github.com/zotero/zotero-plugin-scaffold) - Zotero 插件开发脚手架
- [Ollama](https://ollama.ai/) - 本地 LLM 运行环境

## 📮 联系方式

- **Issues**: [GitHub Issues](https://github.com/Callioper/zotero-aireader/issues)
- **Email**: callioper@example.com

---

**注意**：本插件目前仅支持 Zotero 9 Beta 及以上版本。Zotero 7 用户请等待正式版发布。
