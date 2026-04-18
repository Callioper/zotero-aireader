import {
  AISkill,
  SkillContext,
  SkillResult,
  extractQuotes,
  formatMetadataForPrompt,
} from "./types";

/**
 * 阅读向导 - Reading Guide
 *
 * Provides reading strategies, thought-provoking questions,
 * and discussion topics to help readers engage more deeply
 * with the text.
 */
export const readingGuideSkill: AISkill = {
  id: "guide",
  nameKey: "skill-guide",
  icon: "\u{1F9ED}",
  descriptionKey: "skill-guide-desc",
  color: "#ff9500",

  buildSystemPrompt(context: SkillContext): string {
    const meta = formatMetadataForPrompt(context.itemMetadata);
    return `你是一位经验丰富的阅读导师。请为读者提供阅读这篇文献的指导和建议。

文献信息:
${meta}

请提供以下内容:

1. **阅读路线图**
   - 建议的阅读顺序（如果不必从头到尾线性阅读）
   - 各部分的重要程度和阅读深度建议
   - 可以快速浏览的部分 vs 需要精读的部分

2. **思考问题**（5-8个）
   - 帮助读者在阅读过程中主动思考
   - 从理解层、分析层、评价层递进
   - 引导读者关注容易忽略的要点

3. **讨论话题**（3-5个）
   - 适合读书会或学术讨论的开放性话题
   - 可以连接到更广泛的学术或现实议题

4. **延伸阅读建议**
   - 基于文献内容，建议相关的阅读方向
   - 提示可以进一步深入的领域

5. **背景知识提示**
   - 理解本文需要的前置知识
   - 可能不熟悉的学科背景

格式规范:
- 引用原文时使用 [[QUOTE: "原文内容"]] 格式
- 使用 Markdown 格式输出
- 语言: 中文`;
  },

  buildUserMessage(context: SkillContext): string {
    if (context.selectedText) {
      return `请针对以下选中的部分提供阅读指导和思考问题:\n\n"${context.selectedText}"`;
    }
    if (context.userQuery) {
      return context.userQuery;
    }
    return "请为这篇文献提供完整的阅读指导。";
  },

  parseResult(rawResponse: string): SkillResult {
    return {
      content: rawResponse,
      quotes: extractQuotes(rawResponse),
    };
  },
};
