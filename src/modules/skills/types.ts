/**
 * AI Skill System - Type definitions
 *
 * Each skill represents a specialized AI analysis capability.
 * Skills define their own system prompts, result parsing, and annotation colors.
 */

/** Context passed to a skill when building its prompt */
export interface SkillContext {
  /** Full text of the PDF document (may be truncated for token limits) */
  fullText: string;
  /** User-selected text from the PDF reader, if any */
  selectedText?: string;
  /** Bibliographic metadata from the Zotero item */
  itemMetadata: ItemMetadata;
  /** Additional user question or instruction */
  userQuery?: string;
}

export interface ItemMetadata {
  title: string;
  creators: string[];
  date?: string;
  abstractNote?: string;
  itemType?: string;
}

/** Parsed result from AI response */
export interface SkillResult {
  /** The full response content (for display) */
  content: string;
  /** Extracted quotes marked with [[QUOTE: "..."]] */
  quotes: ExtractedQuote[];
}

export interface ExtractedQuote {
  /** The original text from the document */
  text: string;
  /** Optional annotation comment (skill-generated context) */
  comment?: string;
}

/** AI Skill interface - all skills must implement this */
export interface AISkill {
  /** Unique skill identifier */
  id: string;
  /** Display name (localized) */
  nameKey: string;
  /** Emoji icon for UI display */
  icon: string;
  /** l10n key for description tooltip */
  descriptionKey: string;
  /** Highlight annotation color for this skill */
  color: string;

  /**
   * Build the system prompt for this skill.
   * The returned string is sent as `skill_prompt` to the backend,
   * where it gets combined with RAG context automatically.
   */
  buildSystemPrompt(context: SkillContext): string;

  /**
   * Build the user message for this skill.
   * This is sent as the `question` field to the backend.
   */
  buildUserMessage(context: SkillContext): string;

  /**
   * Parse the AI response to extract structured results.
   * Extracts [[QUOTE: "..."]] markers and other skill-specific data.
   */
  parseResult(rawResponse: string): SkillResult;
}

// ─── Shared Utilities ────────────────────────────────────────

const QUOTE_REGEX = /\[\[QUOTE:\s*"([^"]+)"\]\]/g;

/**
 * Extract all [[QUOTE: "..."]] markers from AI response text.
 */
export function extractQuotes(text: string): ExtractedQuote[] {
  const quotes: ExtractedQuote[] = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  QUOTE_REGEX.lastIndex = 0;

  while ((match = QUOTE_REGEX.exec(text)) !== null) {
    quotes.push({ text: match[1] });
  }
  return quotes;
}

/**
 * Build a metadata summary string for inclusion in prompts.
 */
export function formatMetadataForPrompt(meta: ItemMetadata): string {
  const parts: string[] = [];
  if (meta.title) parts.push(`标题: ${meta.title}`);
  if (meta.creators.length > 0) parts.push(`作者: ${meta.creators.join(", ")}`);
  if (meta.date) parts.push(`日期: ${meta.date}`);
  if (meta.itemType) parts.push(`类型: ${meta.itemType}`);
  return parts.join("\n");
}
