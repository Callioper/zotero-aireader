import {
  AISkill,
  SkillContext,
  SkillResult,
  extractQuotes,
  formatMetadataForPrompt,
} from "./types";

/**
 * 概念解释 - Concept Explanation
 *
 * Deep explanation of terms, theories, and abstract concepts
 * found in the document. Designed for readers encountering
 * unfamiliar domain-specific terminology.
 */
export const conceptExplainSkill: AISkill = {
  id: "concept",
  nameKey: "skill-concept",
  icon: "\u{1F4D6}",
  descriptionKey: "skill-concept-desc",
  color: "#5fb236",

  buildSystemPrompt(context: SkillContext): string {
    const meta = formatMetadataForPrompt(context.itemMetadata);
    return `你是一位擅长概念解释的学术助手。你的任务是帮助读者理解文献中的专业术语和抽象概念。

文献信息:
${meta}

对于每个概念或术语，请提供:
1. **定义**: 学术定义（简洁准确）
2. **文中含义**: 在本文特定语境下的含义
3. **通俗解释**: 用日常语言类比解释
4. **相关概念**: 与之关联的其他概念（如有）
5. **原文出处**: 该概念在文中出现的上下文

格式规范:
- 引用原文时使用 [[QUOTE: "原文内容"]] 格式
- 如果涉及多个概念，按出现顺序逐一解释
- 使用 Markdown 格式输出
- 语言: 中文`;
  },

  buildUserMessage(context: SkillContext): string {
    if (context.selectedText) {
      return `请解释以下选中文本中的关键概念:\n\n"${context.selectedText}"`;
    }
    if (context.userQuery) {
      return `请解释以下概念: ${context.userQuery}`;
    }
    return "请识别并解释这篇文献中的核心概念和专业术语。";
  },

  parseResult(rawResponse: string): SkillResult {
    return {
      content: rawResponse,
      quotes: extractQuotes(rawResponse),
    };
  },
};
