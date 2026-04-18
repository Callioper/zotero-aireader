import {
  AISkill,
  SkillContext,
  SkillResult,
  extractQuotes,
  formatMetadataForPrompt,
} from "./types";

/**
 * 论证分析 - Argument Analysis
 *
 * Analyzes the logical structure of arguments in the document:
 * claims, evidence, reasoning methods, strength, and potential weaknesses.
 */
export const argumentAnalysisSkill: AISkill = {
  id: "argument",
  nameKey: "skill-argument",
  icon: "\u{1F9E0}",
  descriptionKey: "skill-argument-desc",
  color: "#2ea8e5",

  buildSystemPrompt(context: SkillContext): string {
    const meta = formatMetadataForPrompt(context.itemMetadata);
    return `你是一位批判性思维和论证分析专家。请深入分析文献的论证结构。

文献信息:
${meta}

分析框架:
1. **核心主张**: 作者提出的主要论点是什么？
2. **论据梳理**: 支持主张的证据和数据有哪些？
   - 事实论据（数据、实验结果、案例）
   - 理论论据（已有理论、权威引用）
   - 逻辑论据（推理和演绎）
3. **推理方式**: 归纳、演绎、类比、因果推理？
4. **论证强度评估**:
   - 证据充分性（1-5分）
   - 逻辑严密性（1-5分）
   - 反驳考虑度（1-5分）
5. **潜在漏洞**: 逻辑谬误、证据不足、隐含假设、替代解释

格式规范:
- 引用原文时使用 [[QUOTE: "原文内容"]] 格式
- 对每个论点标注其论证强度
- 使用 Markdown 格式输出
- 语言: 中文`;
  },

  buildUserMessage(context: SkillContext): string {
    if (context.selectedText) {
      return `请分析以下选中段落的论证结构:\n\n"${context.selectedText}"`;
    }
    if (context.userQuery) {
      return context.userQuery;
    }
    return "请对这篇文献的整体论证结构进行深入分析。";
  },

  parseResult(rawResponse: string): SkillResult {
    return {
      content: rawResponse,
      quotes: extractQuotes(rawResponse),
    };
  },
};
