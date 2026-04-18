// AI Reader - Default Preferences
// Prefix: extensions.zotero-zoteroAIRreader

// General
pref("enable", true);

// Chat LLM (required)
pref("llmProvider", "ollama");
pref("apiBaseUrl", "");
pref("apiKey", "");
pref("modelName", "");

// Embedding (optional — disabled by default)
pref("embeddingEnabled", false);
pref("embeddingModel", "");

// Features
pref("language", "zh");
pref("autoIndex", false);
pref("historyRounds", 10);

// Annotations
pref("autoHighlight", true);
pref("colorSummary", "#ffd400");
pref("colorConcept", "#5fb236");
pref("colorArgument", "#2ea8e5");
pref("colorCharacters", "#a28ae5");
pref("colorQuotes", "#ff6666");
pref("colorGuide", "#ff9500");
