/**
 * AI Skills Registry
 *
 * Central registry for all AI skills. Import this module to access
 * the full list of available skills or look up a skill by ID.
 */

import { AISkill } from "./types";
import { summarySkill } from "./summary";
import { conceptExplainSkill } from "./concept-explain";
import { argumentAnalysisSkill } from "./argument-analysis";
import { characterTrackingSkill } from "./character-tracking";
import { quoteCollectorSkill } from "./quote-collector";
import { readingGuideSkill } from "./reading-guide";

/** All registered skills, in display order */
export const ALL_SKILLS: AISkill[] = [
  summarySkill,
  conceptExplainSkill,
  argumentAnalysisSkill,
  characterTrackingSkill,
  quoteCollectorSkill,
  readingGuideSkill,
];

/** Look up a skill by its unique ID */
export function getSkillById(id: string): AISkill | undefined {
  return ALL_SKILLS.find((s) => s.id === id);
}

// Re-export types and utilities
export type { AISkill, SkillContext, SkillResult, ExtractedQuote, ItemMetadata } from "./types";
export { extractQuotes, formatMetadataForPrompt } from "./types";
