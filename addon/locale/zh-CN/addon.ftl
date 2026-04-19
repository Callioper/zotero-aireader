startup-begin = 插件加载中
startup-finish = 插件已就绪
prefs-title = AI 阅读器设置
prefs-table-title = 标题
prefs-table-detail = 详情
pref-title = AI 阅读器设置
pref-enable = 启用 AI 阅读器
pref-input = 输入
pref-help = { $name } v{ $version } ({ $time })

# Preferences - Sections
pref-section-chat = 对话模型 (Chat)
pref-section-chat-desc = 必填。配置 AI 对话服务，用于问答、摘要、分析等所有功能。
pref-section-embedding = 向量模型 (Embedding)
pref-section-embedding-desc = 可选。启用后可使用语义检索（RAG），提升长文档问答质量。不启用也能正常使用所有功能。
pref-section-features = 功能配置
pref-section-annotations = 标注配置

# Preferences - Chat LLM
pref-llm-provider = LLM 提供商
pref-api-base-url = API 地址
pref-api-key = API 密钥
pref-model-name = 对话模型

# Preferences - Embedding
pref-embedding-enabled = 启用向量检索 (Embedding)
pref-embedding-provider = Embedding 提供商
pref-embedding-base-url = Embedding 服务器
pref-embedding-api-key = Embedding API 密钥
pref-embedding-model = Embedding 模型
pref-indexing-mode = 索引模式

# Preferences - Features
pref-language = 默认语言
pref-auto-index = 打开 PDF 时自动建立索引
pref-history-rounds = 对话保留轮数

# Preferences - Annotations
pref-auto-highlight = AI 引用自动创建高亮标注
pref-color-summary = 摘要
pref-color-concept = 概念
pref-color-argument = 论证
pref-color-characters = 人物
pref-color-quotes = 金句
pref-color-guide = 向导

# Menu (XUL menu elements require .label attribute format)
zotero-air-reader-menu-label =
  .label = AI Reader
zotero-air-reader-menu-ai-chat =
  .label = AI 问答
zotero-air-reader-menu-summarize =
  .label = 总结文献
zotero-air-reader-menu-search =
  .label = 语义搜索

# AI Panel (right sidebar)
zotero-air-reader-panel-header = AI 阅读助手
zotero-air-reader-panel-sidenav = AI 助手

# AI Skills
skill-summary = 智能摘要
skill-summary-desc = 生成文献结构化摘要，提取核心论点和关键信息
skill-concept = 概念解释
skill-concept-desc = 深入解释文中的专业术语和抽象概念
skill-argument = 论证分析
skill-argument-desc = 分析论证结构、证据强度和逻辑漏洞
skill-characters = 人物追踪
skill-characters-desc = 提取文中人物和机构，分析关系网络
skill-quotes = 金句收藏
skill-quotes-desc = 发现并收藏文中精彩语句和名言
skill-guide = 阅读向导
skill-guide-desc = 提供阅读建议、思考问题和讨论话题

# Reader toolbar
reader-toolbar-ai-btn = AI 助手

# Setup guide (shown in panel when not configured)
setup-welcome = 欢迎使用 AI 阅读助手
setup-step1 = 选择 AI 服务商（Ollama / DeepSeek / OpenAI 等）
setup-step2 = 填写 API 地址和模型名称
setup-open-settings = 打开设置
setup-chat-error = 对话模型连接失败
setup-retry = 重试