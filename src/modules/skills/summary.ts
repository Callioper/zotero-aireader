import {
  AISkill,
  SkillContext,
  SkillResult,
  extractQuotes,
  formatMetadataForPrompt,
} from "./types";

/**
 * 智能摘要 - Smart Summary
 *
 * Generates a structured summary of the document including:
 * - Core thesis (1-3 sentences)
 * - Section-by-section summary
 * - Key information extraction
 */
export const summarySkill: AISkill = {
  id: "summary",
  nameKey: "skill-summary",
  icon: "\u{1F4CB}",
  descriptionKey: "skill-summary-desc",
  color: "#ffd400",

  buildSystemPrompt(context: SkillContext): string {
    const meta = formatMetadataForPrompt(context.itemMetadata);
    return `你是一位专业的学术文献分析助手。请对以下文献进行深度分析，生成结构化摘要。

文献信息:
${meta}

输出要求:
1. **核心论点**（1-3句话概括文献的核心主张或发现）
2. **研究方法**（如适用：研究设计、数据来源、分析方法）
3. **主要发现/论点**（按章节或主题分点列出）
4. **关键结论**（作者的最终结论和贡献）
5. **局限与展望**（如有提及）

格式规范:
- 在引用原文时，必须使用 [[QUOTE: "原文内容"]] 格式标记
- 每个要点尽量附带原文引用
- 使用 Markdown 格式输出
- 语言: 中文`;
  },

  buildUserMessage(context: SkillContext): string {
    if (context.selectedText) {
      return `请分析以下选中的段落，生成结构化摘要:\n\n"${context.selectedText}"`;
    }
    if (context.userQuery) {
      return context.userQuery;
    }
    return "请对这篇文献进行全面的结构化摘要分析。";
  },

  parseResult(rawResponse: string): SkillResult {
    return {
      content: rawResponse,
      quotes: extractQuotes(rawResponse),
    };
  },
};
