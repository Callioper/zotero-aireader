# Release v1.0.0 - Zotero AI Reader

## 🎉 首个正式版本发布

Zotero AI Reader 是一个为 Zotero 9 设计的 AI 阅读助手插件，提供智能文献分析、概念解释、论证分析等功能。

## ✨ 主要特性

### 🤖 六大 AI 技能
- **智能摘要** - 生成文献结构化摘要
- **概念解释** - 深入解释专业术语
- **论证分析** - 分析论证结构和逻辑
- **人物追踪** - 提取人物和机构关系
- **金句收藏** - 发现精彩语句
- **阅读向导** - 提供阅读建议和思考问题

### 🎯 核心功能
- **右侧边栏 AI 面板** - 在 PDF 阅读器右侧提供 AI 对话界面
- **智能引用标注** - AI 生成的引用自动转为 PDF 高亮，支持点击跳转
- **纯内置模式** - 无需 Python 后端，插件直接调用 LLM API
- **内嵌 RAG 引擎** - 自动建立索引，支持语义搜索
- **多模型支持** - 支持 OpenAI、DeepSeek、Ollama、LM Studio 等
- **本地优先** - 支持 Ollama 本地模型，保护数据隐私

## 📦 安装

### 系统要求
- Zotero 9 Beta 或更高版本
- Windows / macOS / Linux

### 安装步骤
1. 下载 `zotero-ai-reader.xpi`
2. 打开 Zotero 9，进入 `工具` → `插件`
3. 点击右上角齿轮图标 → `Install Add-on From File...`
4. 选择下载的 `.xpi` 文件

## 🚀 快速开始

### 推荐配置：Ollama（本地，免费）

```bash
# 1. 安装 Ollama (https://ollama.ai/)

# 2. 下载模型
ollama pull qwen2.5:7b
ollama pull nomic-embed-text

# 3. 在 Zotero 中配置
# 编辑 → 首选项 → AI Reader
# - LLM 提供商: Ollama (local)
# - 对话模型: qwen2.5:7b
# - Embedding 模型: nomic-embed-text
```

### 备选方案：DeepSeek（在线，便宜）

1. 获取 API Key: https://platform.deepseek.com/
2. 在插件设置中填入 API Key
3. 选择模型：`deepseek-chat`

详细使用指南请查看 [USAGE.md](https://github.com/Callioper/zotero-aireader/blob/main/USAGE.md)

## 🐛 已知问题

- 首次索引大型 PDF（>100 页）可能需要较长时间
- 某些 PDF 的坐标映射可能不准确，会自动降级为笔记标注

## 🔧 技术细节

### 架构
- **前端**: TypeScript + Zotero Plugin API
- **LLM 客户端**: 内置，支持 OpenAI 兼容 API
- **RAG 引擎**: 内置，支持向量搜索 + BM25 混合检索
- **构建工具**: zotero-plugin-scaffold (esbuild)

### 关键修复
本版本修复了 5 个关键 bug：
1. ✅ 菜单结构错误（submenu vs menu）
2. ✅ FTL 格式错误（.label 属性）
3. ✅ Locale 资源未注册
4. ✅ FTL 加载时机错误
5. ✅ 偏好设置重复注册

## 📝 更新日志

### Added
- AI 面板集成到右侧边栏
- 6 个 AI 技能模块
- 内置 LLM 客户端（支持多提供商）
- 内置 RAG 引擎（向量搜索 + BM25）
- 智能标注管理器
- 右键菜单集成
- PDF 工具栏按钮
- 偏好设置面板
- 中英文本地化

### Fixed
- 菜单文本不显示问题
- 偏好面板重复显示问题
- Locale 资源加载问题

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

AGPL-3.0

## 🙏 致谢

- [Zotero](https://www.zotero.org/)
- [zotero-plugin-scaffold](https://github.com/zotero/zotero-plugin-scaffold)
- [Ollama](https://ollama.ai/)

---

**注意**: 本插件目前仅支持 Zotero 9 Beta 及以上版本。
