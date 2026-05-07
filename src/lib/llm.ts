// ============================================================
// LLM 调用封装
// 使用 coze-coding-dev-sdk 内置 SDK
// ============================================================

import { LLMClient, Config } from "coze-coding-dev-sdk";
import type {
  DiagnosisAnalysis,
  KnowledgePoint,
  PracticeQuestion,
} from "@/types";

// ============================================================
// 客户端初始化
// ============================================================

// 创建全局 LLM 客户端
const getClient = () => new LLMClient(new Config());

// ============================================================
// 通用调用函数
// ============================================================

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

interface LLMResponse {
  content: string;
}

// 流式调用
export async function* streamLLM(
  messages: Message[],
  temperature: number = 0.7
): AsyncGenerator<string> {
  const client = getClient();

  for await (const chunk of client.stream(messages, { temperature })) {
    if (chunk.content) {
      yield chunk.content.toString();
    }
  }
}

export async function invokeLLM(
  messages: Message[],
  temperature: number = 0.7
): Promise<LLMResponse> {
  const client = getClient();

  const result = await client.invoke(messages, { temperature });

  return {
    content: result.content?.toString() || "",
  };
}

// ============================================================
// Prompt 模板
// ============================================================
const SYSTEM_PROMPTS = {
  translateAndDiagnose: `你是一位专业的英文翻译专家和耐心的英文学习教练。

任务分两步：
第一步：翻译原文为中文
第二步：对比用户翻译与你的翻译，分析用户的理解情况

分析维度：
- correct（理解正确）：用户翻译准确表达了原意
- alternative（表达可优化）：意思正确但有更精准/更地道的表达
- missed（遗漏要点）：用户漏译或理解不到位的重要内容

反馈原则：
1. 先肯定：先列出用户理解正确的部分，给予正向反馈
2. 再建议：对差异和遗漏给出具体、可操作的改进建议
3. 不批评：语气温和，避免让用户产生挫败感
4. 讲道理：每个建议都要解释"为什么"

输出格式（JSON）：
{
  "aiTranslation": "你的参考翻译（中文）",
  "diagnosis": {
    "correct": [
      {"text": "原文片段", "feedback": "用户理解准确的说明"}
    ],
    "alternative": [
      {"original": "原文", "yourTranslation": "用户的翻译", "betterTranslation": "更好的翻译", "reason": "为什么更好的说明"}
    ],
    "missed": [
      {"text": "漏译的原文", "meaning": "含义解释", "reason": "为什么重要的说明"}
    ]
  }
}`,

  extractKnowledgeFromDiagnosis: `你是一位细心的英文学习分析师。

你将收到：
- 原文
- AI 参考翻译
- 用户翻译
- 诊断分析结果（包含正确、可优化、遗漏）

任务：
基于诊断分析中的"表达可优化"(alternative)和"遗漏要点"(missed)，
结合原文，提取对用户有学习价值的知识点。

知识点分类（由你根据内容自行判断）：
- word：单词
- phrase：词组/固定搭配
- pattern：句式/表达模式
- comprehension_point：理解难点

提取规则：
1. 只从"alternative"和"missed"中提取，不要随意从原文提取其他知识点
2. 知识点要与用户翻译中的问题相关
3. 数量和类型由你根据实际情况判断

输出格式（JSON数组）：
[
  {
    "type": "word|phrase|pattern|comprehension_point",
    "content": "知识点原文",
    "meaning": "中文含义",
    "explanation": "解释说明",
    "difficulty": "cet4|cet6|toefl|ielts|advanced"
  }
]`,


  generateQuestions: `你是一位英文练习题设计师，为学习者创建高质量的练习题。

题型说明：
1. 选词填空：给出带空格的句子，提供选项
2. 短语配对：左侧短语，右侧含义，正确匹配
3. 理解判断：判断陈述是否与原文相符

出题原则：
1. 考察理解而非记忆：选项要放在语境中判断
2. 干扰项合理：干扰项要与正确项有一定关联
3. 解析详尽：解释为什么选这个
4. 回到原文：题目要能关联到学习的语境

输出格式（JSON）：
{
  "questions": [
    {
      "type": "fill_blank|match|judge",
      "question": "题目内容",
      "options": ["A", "B", "C", "D"], // 选词填空
      "pairs": [{"phrase": "", "meaning": ""}], // 配对题
      "correctAnswer": "正确答案|true|false",
      "explanation": "详细解析",
      "commonMistake": "常见错误（如有）"
    }
  ],
  "totalCount": 5,
  "estimatedTime": "约5分钟"
}`,
};



// 生成练习题
export async function generatePracticeQuestions(
  knowledgePoints: Array<{ content: string; meaning: string; type: string }>,
  count: number = 5
): Promise<{ questions: PracticeQuestion[]; totalCount: number; estimatedTime: string }> {
  const pointsText = knowledgePoints
    .map((p, i) => `${i + 1}. [${p.type}] ${p.content} - ${p.meaning}`)
    .join("\n");

  const response = await invokeLLM(
    [
      { role: "system", content: SYSTEM_PROMPTS.generateQuestions },
      {
        role: "user",
        content: `请基于以下知识点生成 ${count} 道练习题：

${pointsText}

每种题型适当搭配，题目要结合语境。`,
      },
    ],
    0.7
  );

  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        questions: result.questions || [],
        totalCount: result.totalCount || count,
        estimatedTime: result.estimatedTime || `约${count}分钟`,
      };
    }
  } catch {
    // 解析失败
  }

  return {
    questions: [],
    totalCount: 0,
    estimatedTime: "",
  };
}

// ============================================================
// 完整的诊断流程（翻译 + 诊断 + 知识点提取）
// ============================================================

export interface FullDiagnosisResult {
  aiTranslation: string;
  analysis: DiagnosisAnalysis;
  knowledgePoints: Omit<KnowledgePoint, "id" | "createdAt">[];
}

// 步骤1+2：翻译 + 诊断分析
async function translateAndDiagnose(
  originalParagraph: string,
  userTranslation: string
): Promise<{ aiTranslation: string; analysis: DiagnosisAnalysis }> {
  const response = await invokeLLM(
    [
      { role: "system", content: SYSTEM_PROMPTS.translateAndDiagnose },
      {
        role: "user",
        content: `请翻译原文并进行诊断分析：

原文：
---
${originalParagraph}
---

用户翻译：
---
${userTranslation}
---

请输出 JSON 格式的结果，包含 AI 翻译和诊断分析。`,
      },
    ],
    0.7
  );

  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        aiTranslation: result.aiTranslation || "",
        analysis: result.diagnosis || {
          correct: [],
          alternative: [],
          missed: [],
        },
      };
    }
  } catch {
    // 解析失败
  }

  return {
    aiTranslation: "",
    analysis: { correct: [], alternative: [], missed: [] },
  };
}

// 步骤3：基于诊断结果提取知识点
async function extractKnowledgeFromDiagnosis(
  originalParagraph: string,
  userTranslation: string,
  aiTranslation: string,
  analysis: DiagnosisAnalysis,
  sourceParagraphId: string,
  sourceArticleId: string,
  sourceArticleTitle: string
): Promise<Omit<KnowledgePoint, "id" | "createdAt">[]> {
  const response = await invokeLLM(
    [
      { role: "system", content: SYSTEM_PROMPTS.extractKnowledgeFromDiagnosis },
      {
        role: "user",
        content: `请基于诊断分析结果提取知识点：

原文：
---
${originalParagraph}
---

AI 参考翻译：
---
${aiTranslation}
---

用户翻译：
---
${userTranslation}
---

诊断分析结果：
${JSON.stringify(analysis, null, 2)}

请输出 JSON 数组格式的知识点。`,
      },
    ],
    0.5
  );

  try {
    const jsonMatch = response.content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const points = JSON.parse(jsonMatch[0]);
      return points.map((p: {
        type: string;
        content: string;
        meaning: string;
        explanation?: string;
        difficulty: string;
      }) => ({
        type: p.type as KnowledgePoint["type"],
        content: p.content,
        meaning: p.meaning,
        explanation: p.explanation || "",
        difficulty: p.difficulty as KnowledgePoint["difficulty"],
        example: originalParagraph,
        sourceParagraphId,
        sourceArticleId,
        sourceArticleTitle,
        masterStatus: "learning" as const,
        reviewCount: 0,
      }));
    }
  } catch {
    // 解析失败
  }

  return [];
}

export async function performFullDiagnosis(
  originalParagraph: string,
  userTranslation: string,
  sourceParagraphId: string,
  sourceArticleId: string,
  sourceArticleTitle: string
): Promise<FullDiagnosisResult> {
  // 步骤1+2：翻译 + 诊断分析（一次调用）
  const { aiTranslation, analysis } = await translateAndDiagnose(
    originalParagraph,
    userTranslation
  );

  // 步骤3：基于诊断结果提取知识点
  const knowledgePoints = await extractKnowledgeFromDiagnosis(
    originalParagraph,
    userTranslation,
    aiTranslation,
    analysis,
    sourceParagraphId,
    sourceArticleId,
    sourceArticleTitle
  );

  return {
    aiTranslation,
    analysis,
    knowledgePoints,
  };
}
