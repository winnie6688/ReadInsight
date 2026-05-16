// ============================================================
// 核心数据类型定义
// ============================================================

// 文章输入类型
export type ArticleInputType = "url" | "paste" | "upload";

// 知识点类型
export type KnowledgePointType = "word" | "phrase" | "pattern" | "comprehension_point";

// 难度等级
export type DifficultyLevelType = "cet4" | "cet6" | "toefl" | "ielts" | "advanced";

// 掌握状态
export type MasterStatus = "learning" | "mastered" | "待学习" | "学习中" | "已掌握";

// 段落状态
export type ParagraphStatus = "unread" | "in_progress" | "completed";

// 文章状态
export type ArticleStatus = "reading" | "completed";

// 来源类型
export type SourceType = "url" | "paste" | "upload";

// 练习题类型
export type QuestionType = "fill_blank" | "match" | "rewrite" | "judge";

// ============================================================
// 文章相关
// ============================================================

export interface ArticleInput {
  type: ArticleInputType;
  url?: string;
  title?: string;
  content?: string;
}

export interface Paragraph {
  id: string;
  articleId: string;
  index: number;
  content: string;
  status: ParagraphStatus;
  userTranslation?: string;
  aiTranslation?: string;
  knowledgePoints?: KnowledgePoint[];
}

export interface Article {
  id: string;
  url?: string;
  title: string;
  sourceType: SourceType;
  paragraphs: Paragraph[];
  wordCount: number;
  readingTime: number;
  createdAt: number;
  status: ArticleStatus;
  practicedCount?: number;
  knowledgePointCount?: number;
  // AI 生成的文章总结
  aiSummary?: string;
}

// ============================================================
// 知识点相关
// ============================================================

export interface KnowledgePoint {
  id: string;
  type: KnowledgePointType;
  content: string;
  meaning: string;
  explanation?: string;
  difficulty: DifficultyLevelType;
  example?: string;
  sourceParagraphId: string;
  sourceArticleId: string;
  sourceArticleTitle: string;
  masterStatus: MasterStatus;
  reviewCount: number;
  lastReviewAt?: number;
  createdAt: number;
}

// ============================================================
// 诊断分析相关
// ============================================================

export interface CorrectFeedback {
  text: string;
  feedback: string;
}

export interface AlternativeFeedback {
  original: string;
  yourTranslation: string;
  betterTranslation: string;
  reason: string;
}

export interface MissedFeedback {
  text: string;
  meaning: string;
  reason: string;
}

export interface DiagnosisAnalysis {
  correct: CorrectFeedback[];
  alternative: AlternativeFeedback[];
  missed: MissedFeedback[];
}

export interface DiagnosisResult {
  aiTranslation: string;
  analysis: DiagnosisAnalysis;
  knowledgePoints: Omit<KnowledgePoint, "id" | "createdAt">[];
}

// ============================================================
// 练习题相关
// ============================================================

export interface FillBlankQuestion {
  type: "fill_blank";
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  relatedPointId?: string;
}

export interface MatchQuestion {
  type: "match";
  question: string;
  pairs: Array<{ phrase: string; meaning: string }>;
  correctAnswers: Record<string, string>;
  explanation: string;
  relatedPointId?: string;
}

export interface JudgeQuestion {
  type: "judge";
  question: string;
  correctAnswer: boolean;
  explanation: string;
  commonMistake?: string;
  relatedPointId?: string;
}

export interface RewriteQuestion {
  type: "rewrite";
  question: string;
  correctAnswer: string;
  explanation: string;
  relatedPointId?: string;
}

export type PracticeQuestion = FillBlankQuestion | MatchQuestion | JudgeQuestion | RewriteQuestion;

export interface PracticeResult {
  questions: PracticeQuestion[];
  totalCount: number;
  estimatedTime: string;
}

// ============================================================
// 难度分析相关
// ============================================================


// ============================================================
// 用户进度相关
// ============================================================

export interface UserProgress {
  totalArticlesRead: number;
  totalParagraphsPracticed: number;
  totalKnowledgePoints: number;
  masteredKnowledgePoints: number;
  currentStreak: number;
  totalMinutes: number;
  lastPracticeAt?: number;
}

// ============================================================
// 练习记录相关
// ============================================================

export interface PracticeRecord {
  id: string;
  articleId: string;
  articleTitle: string;
  paragraphId: string;
  paragraphIndex: number;
  paragraphContent: string;
  userTranslation: string;
  aiTranslation: string;
  knowledgePoints: string[];
  duration: number;
  practicedAt: number;
}

// ============================================================
// API 响应类型
// ============================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: string;
  };
}

// ============================================================
// API 请求类型
// ============================================================

export interface ParseArticleRequest {
  type: ArticleInputType;
  url?: string;
  title?: string;
  content?: string;
}

export interface ParseArticleResponse {
  id: string;
  title: string;
  url?: string;
  paragraphs: Paragraph[];
  wordCount: number;
  readingTime: number;
  recommendedParagraphs: string[];
  // AI 生成的文章总结
  aiSummary?: string;
}

export interface DiagnoseRequest {
  articleId: string;
  paragraphId: string;
  originalParagraph: string;
  userTranslation: string;
}

export interface DiagnoseResponse extends DiagnosisResult {
  paragraphId: string;
}

export interface GeneratePracticeRequest {
  knowledgePoints: KnowledgePoint[];
  count?: number;
  articleContext?: string;
}

export type GeneratePracticeResponse = PracticeResult;
