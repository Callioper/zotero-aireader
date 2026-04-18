import { config } from "../../package.json";

const PREFS_PREFIX = config.prefsPrefix;

/**
 * Get a preference value by key.
 * Keys correspond to entries in prefs.js (without prefix).
 */
export function getPref(key: string): any {
  return Zotero.Prefs.get(`${PREFS_PREFIX}.${key}`, true);
}

export function setPref(key: string, value: any) {
  return Zotero.Prefs.set(`${PREFS_PREFIX}.${key}`, value, true);
}

export function clearPref(key: string) {
  return Zotero.Prefs.clear(`${PREFS_PREFIX}.${key}`, true);
}

// ─── Typed Preference Getters ───────────────────────────────

/** Whether the plugin is enabled */
export function isEnabled(): boolean {
  return getPref("enable") !== false;
}

/** Backend API URL */
export function getApiUrl(): string {
  return (getPref("apiUrl") as string) || "http://127.0.0.1:8765/api";
}

/** LLM provider name */
export function getLLMProvider(): string {
  return (getPref("llmProvider") as string) || "ollama";
}

/** LLM model name */
export function getModelName(): string {
  return (getPref("modelName") as string) || "";
}

/** Default output language */
export function getLanguage(): string {
  return (getPref("language") as string) || "zh";
}

/** Whether embedding / RAG is enabled */
export function isEmbeddingEnabled(): boolean {
  return getPref("embeddingEnabled") === true;
}

/** Auto-index PDF when opened (only meaningful when embedding is enabled) */
export function isAutoIndex(): boolean {
  return isEmbeddingEnabled() && getPref("autoIndex") !== false;
}

/** Number of conversation rounds to keep */
export function getHistoryRounds(): number {
  const val = getPref("historyRounds");
  return typeof val === "number" ? val : 10;
}

/** Auto-create highlight annotations from AI quotes */
export function isAutoHighlight(): boolean {
  return getPref("autoHighlight") !== false;
}

/** Get annotation color for a skill ID */
export function getSkillColor(skillId: string): string {
  const colorMap: Record<string, { key: string; fallback: string }> = {
    summary: { key: "colorSummary", fallback: "#ffd400" },
    concept: { key: "colorConcept", fallback: "#5fb236" },
    argument: { key: "colorArgument", fallback: "#2ea8e5" },
    characters: { key: "colorCharacters", fallback: "#a28ae5" },
    quotes: { key: "colorQuotes", fallback: "#ff6666" },
    guide: { key: "colorGuide", fallback: "#ff9500" },
  };

  const entry = colorMap[skillId];
  if (!entry) return "#ffd400";
  return (getPref(entry.key) as string) || entry.fallback;
}
