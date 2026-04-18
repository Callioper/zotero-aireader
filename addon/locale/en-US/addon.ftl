startup-begin = Addon is loading
startup-finish = Addon is ready
prefs-title = AI Reader Settings
prefs-table-title = Title
prefs-table-detail = Detail
pref-title = AI Reader Settings
pref-enable = Enable AI Reader
pref-input = Input
pref-help = { $name } v{ $version } ({ $time })

# Preferences - Sections
pref-section-chat = Chat Model
pref-section-chat-desc = Required. Configure the AI chat service for Q&A, summaries, analysis, and all other features.
pref-section-embedding = Embedding Model
pref-section-embedding-desc = Optional. Enables semantic search (RAG) for better long-document Q&A. All features work without it.
pref-section-features = Feature Settings
pref-section-annotations = Annotation Settings

# Preferences - Chat LLM
pref-llm-provider = LLM Provider
pref-api-base-url = API Base URL
pref-api-key = API Key
pref-model-name = Chat Model

# Preferences - Embedding
pref-embedding-enabled = Enable Embedding (vector search)
pref-embedding-model = Embedding Model

# Preferences - Features
pref-language = Default Language
pref-auto-index = Auto-index PDF when opened
pref-history-rounds = Conversation history rounds

# Preferences - Annotations
pref-auto-highlight = Auto-create highlights from AI quotes
pref-color-summary = Summary
pref-color-concept = Concept
pref-color-argument = Argument
pref-color-characters = Characters
pref-color-quotes = Quotes
pref-color-guide = Guide

# Menu (XUL menu elements require .label attribute format)
zotero-air-reader-menu-label =
  .label = AI Reader
zotero-air-reader-menu-ai-chat =
  .label = AI Chat
zotero-air-reader-menu-summarize =
  .label = Summarize
zotero-air-reader-menu-search =
  .label = Semantic Search

# AI Panel (right sidebar)
zotero-air-reader-panel-header = AI Reading Assistant
zotero-air-reader-panel-sidenav = AI Assistant

# AI Skills
skill-summary = Smart Summary
skill-summary-desc = Generate structured summaries with core arguments and key findings
skill-concept = Concept Explainer
skill-concept-desc = In-depth explanation of technical terms and abstract concepts
skill-argument = Argument Analysis
skill-argument-desc = Analyze logical structure, evidence strength, and reasoning gaps
skill-characters = Entity Tracker
skill-characters-desc = Extract people and organizations, analyze relationship networks
skill-quotes = Quote Collector
skill-quotes-desc = Discover and collect notable quotes and passages
skill-guide = Reading Guide
skill-guide-desc = Reading suggestions, discussion questions, and study topics

# Reader toolbar
reader-toolbar-ai-btn = AI Assistant

# Setup guide (shown in panel when not configured)
setup-welcome = Welcome to AI Reading Assistant
setup-step1 = Choose an AI provider (Ollama / DeepSeek / OpenAI, etc.)
setup-step2 = Enter the API URL and model name
setup-open-settings = Open Settings
setup-chat-error = Chat model connection failed
setup-retry = Retry