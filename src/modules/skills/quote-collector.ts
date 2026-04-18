import {
  AISkill,
  SkillContext,
  SkillResult,
  extractQuotes,
  formatMetadataForPrompt,
} from "./types";

/**
 * 金句收藏 - Quote Collector
 *
 * Discovers and collects notable, insightful, or well-crafted
 * sentences and passages from the document. Each quote is
 * annotated with why it's noteworthy.
 */
export const quoteCollectorSkill: AISkill = {
  id: "quotes",
  nameKey: "skill-quotes",
  icon: "\u2728",
  descriptionKey: "skill-quotes-desc",
  color: "#ff6666",

  buildSystemPrompt(context: SkillContext): string {
    const meta = formatMetadataForPrompt(context.itemMetadata);
    return `你是一位敏锐的文学品鉴专家。请从文献中发现并收藏精彩的语句和段落。

文献信息:
${meta}

收藏标准:
- 🎯 **洞见型**: 揭示深刻道理或独到见解的语句
- 📝 **表达型**: 措辞精妙、修辞出色的语句
- 💡 **启发型**: 能引发思考或启发灵感的语句
- 📊 **论据型**: 有力的数据引用或案例描述
- 🔑 **核心型**: 概括文章核心观点的关键语句

输出格式:
对于每条金句:
1. 用 [[QUOTE: "完整原文"]] 格式标记原文（务必完整准确）
2. 标注类型（洞见/表达/启发/论据/核心）
3. 简要说明为什么这句话值得收藏（1-2句）

要求:
- 至少收集 5-10 条金句
- 引用必须是文献原文，不可改写
- 按出现顺序排列
- 使用 Markdown 格式输出
- 语言: 中文`;
  },

  buildUserMessage(context: SkillContext): string {
    if (context.selectedText) {
      return `请从以下选中的段落中发现值得收藏的金句:\n\n"${context.selectedText}"`;
    }
    if (context.userQuery) {
      return context.userQuery;
    }
    return "请从这篇文献中发现并收藏最精彩的语句和段落。";
  },

  parseResult(rawResponse: string): SkillResult {
    return {
      content: rawResponse,
      quotes: extractQuotes(rawResponse),
    };
  },
};
