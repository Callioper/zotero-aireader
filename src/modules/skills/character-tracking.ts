import {
  AISkill,
  SkillContext,
  SkillResult,
  extractQuotes,
  formatMetadataForPrompt,
} from "./types";

/**
 * 人物追踪 - Character/Entity Tracking
 *
 * Extracts and analyzes people, organizations, and entities
 * mentioned in the document. Tracks their relationships,
 * positions, and development throughout the text.
 */
export const characterTrackingSkill: AISkill = {
  id: "characters",
  nameKey: "skill-characters",
  icon: "\u{1F465}",
  descriptionKey: "skill-characters-desc",
  color: "#a28ae5",

  buildSystemPrompt(context: SkillContext): string {
    const meta = formatMetadataForPrompt(context.itemMetadata);
    return `你是一位文本分析专家，擅长提取和追踪文献中的人物与机构。

文献信息:
${meta}

分析任务:
1. **人物/机构清单**: 列出文中提到的所有重要人物和机构
2. **角色定位**: 每个人物/机构在文中扮演什么角色？（作者引用的学者、研究对象、合作者等）
3. **立场观点**: 各人物/机构的核心立场或贡献是什么？
4. **关系网络**: 人物/机构之间的关系（合作、对立、师承、引用等）
5. **发展轨迹**: 如文中涉及时间跨度，追踪人物/观点的发展变化

输出格式:
- 使用表格或结构化列表呈现人物信息
- 引用原文时使用 [[QUOTE: "原文内容"]] 格式
- 如果关系复杂，可用文字描述关系图
- 使用 Markdown 格式输出
- 语言: 中文`;
  },

  buildUserMessage(context: SkillContext): string {
    if (context.selectedText) {
      return `请分析以下选中文本中涉及的人物和机构:\n\n"${context.selectedText}"`;
    }
    if (context.userQuery) {
      return context.userQuery;
    }
    return "请提取并分析这篇文献中的所有重要人物和机构。";
  },

  parseResult(rawResponse: string): SkillResult {
    return {
      content: rawResponse,
      quotes: extractQuotes(rawResponse),
    };
  },
};
