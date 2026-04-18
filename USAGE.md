# Zotero AI Reader - 快速使用指南

## 安装步骤

1. 下载最新的 `zotero-ai-reader.xpi` 文件
2. 打开 Zotero 9，进入 `工具` → `插件`
3. 点击右上角齿轮图标 → `Install Add-on From File...`
4. 选择下载的 `.xpi` 文件并安装
5. 重启 Zotero

## 配置 LLM 服务

### 推荐方案：使用 Ollama（本地，免费）

1. **安装 Ollama**
   - 访问 https://ollama.ai/ 下载并安装
   - Windows/Mac/Linux 都支持

2. **下载模型**
   ```bash
   # 下载对话模型（推荐 Qwen2.5 7B，约 4.7GB）
   ollama pull qwen2.5:7b
   
   # 下载 Embedding 模型（用于语义搜索，约 274MB）
   ollama pull nomic-embed-text
   ```

3. **配置插件**
   - 打开 Zotero，进入 `编辑` → `首选项` → `AI Reader`
   - **LLM 提供商**：选择 `Ollama (local)`
   - **API 地址**：留空（默认 `http://127.0.0.1:11434`）
   - **对话模型**：`qwen2.5:7b`
   - **Embedding 模型**：`nomic-embed-text`
   - 点击"保存"

### 备选方案：使用 DeepSeek（在线，便宜）

1. **获取 API Key**
   - 访问 https://platform.deepseek.com/
   - 注册并获取 API Key（新用户有免费额度）

2. **配置插件**
   - **LLM 提供商**：选择 `DeepSeek`
   - **API 密钥**：粘贴你的 API Key
   - **对话模型**：`deepseek-chat`
   - **Embedding 模型**：`deepseek-chat`

## 使用方法

### 方法 1：右侧边栏（主要方式）

1. 在 Zotero 中打开一个 PDF 文件
2. 点击右侧边栏的 **AI 助手** 标签
3. 选择一个 AI 技能：
   - **智能摘要** - 快速了解文献核心内容
   - **概念解释** - 解释专业术语
   - **论证分析** - 分析论证逻辑
   - **人物追踪** - 提取人物和机构
   - **金句收藏** - 发现精彩语句
   - **阅读向导** - 获取阅读建议
4. 点击"开始分析"或直接输入问题

### 方法 2：右键菜单

1. 在文献列表中右键点击一个条目
2. 选择 `AI Reader` → 选择功能

### 方法 3：PDF 工具栏

1. 打开 PDF 后，点击工具栏的 **AI** 按钮
2. 在弹出的面板中与 AI 对话

## 核心功能

### 智能标注

AI 回复中的引用会自动转换为 PDF 高亮：
- 格式：`[[QUOTE: "引用文本"]]`
- 点击引用可跳转到原文位置
- 不同技能使用不同颜色标注

### 语义搜索

- 插件会自动为 PDF 建立索引（可在设置中关闭）
- 支持语义搜索和关键词搜索
- 搜索结果会作为上下文提供给 AI

### 对话历史

- 自动保留最近 10 轮对话（可在设置中调整）
- 支持多轮对话，AI 会记住上下文

## 常见问题

### Q: 为什么 AI 没有回复？

A: 检查以下几点：
1. Ollama 是否正在运行？（命令行输入 `ollama list` 检查）
2. 模型是否已下载？
3. API 地址和模型名称是否正确？
4. 查看 Zotero 的错误控制台（`帮助` → `开发者` → `错误控制台`）

### Q: 如何切换语言？

A: 在设置中选择"默认语言"，或在对话中直接说"请用英文回答"

### Q: 标注颜色可以自定义吗？

A: 可以！在 `首选项` → `AI Reader` → `标注颜色` 中自定义每个技能的颜色

### Q: 支持哪些 LLM 提供商？

A: 支持所有 OpenAI 兼容的 API：
- Ollama（本地）
- OpenAI
- DeepSeek
- LM Studio
- Azure OpenAI
- 其他兼容 OpenAI API 的服务

### Q: 数据会上传到云端吗？

A: 如果使用 Ollama 本地模型，所有数据都在本地处理，不会上传。使用在线 API（如 DeepSeek、OpenAI）时，文本会发送到对应的服务器。

## 推荐模型配置

### 性能优先（需要较好的硬件）
- 对话模型：`qwen2.5:14b` 或 `llama3.1:8b`
- Embedding：`nomic-embed-text`

### 平衡配置（推荐）
- 对话模型：`qwen2.5:7b`
- Embedding：`nomic-embed-text`

### 低配置（4GB 显存或 CPU 运行）
- 对话模型：`qwen2.5:3b` 或 `phi3:mini`
- Embedding：`nomic-embed-text`

### 在线服务（无需本地硬件）
- DeepSeek：`deepseek-chat` + `deepseek-chat`
- OpenAI：`gpt-4o-mini` + `text-embedding-3-small`

## 获取帮助

- GitHub Issues: https://github.com/Callioper/zotero-aireader/issues
- 查看完整文档: https://github.com/Callioper/zotero-aireader

---

**提示**：首次使用时，建议先用一个较短的 PDF 测试，确保配置正确后再处理大型文献。
