# GitHub Release 创建指南

## 步骤 1：访问 Release 页面

打开浏览器，访问：
https://github.com/Callioper/zotero-aireader/releases/new

## 步骤 2：填写 Release 信息

### Tag
选择现有标签：`v1.0.0`

### Release Title
```
v1.0.0 - Zotero AI Reader 首个正式版本
```

### Description
复制以下内容：

---

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
1. 下载下方的 `zotero-ai-reader.xpi`
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
- 菜单文本不显示问题（修复 5 个关键 bug）
- 偏好面板重复显示问题
- Locale 资源加载问题

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

AGPL-3.0

---

**注意**: 本插件目前仅支持 Zotero 9 Beta 及以上版本。

---

## 步骤 3：上传文件

点击 "Attach binaries by dropping them here or selecting them" 区域，上传：

**文件路径**: `D:\opencode\ai-reader-zotero-plugin\.scaffold\build\zotero-ai-reader.xpi`

## 步骤 4：发布

- 勾选 "Set as the latest release"
- 点击 "Publish release" 按钮

## 完成！

Release 创建后，用户可以直接从 Release 页面下载 XPI 文件安装。

---

## 可选：创建 update.json

如果需要自动更新功能，还需要创建 `update.json` 文件并上传到 Release：

```json
{
  "addons": {
    "zotero-ai-reader@callioper": {
      "updates": [
        {
          "version": "1.0.0",
          "update_link": "https://github.com/Callioper/zotero-aireader/releases/download/v1.0.0/zotero-ai-reader.xpi",
          "applications": {
            "zotero": {
              "strict_min_version": "6.999"
            }
          }
        }
      ]
    }
  }
}
```

将此文件保存为 `update.json` 并一起上传到 Release。
