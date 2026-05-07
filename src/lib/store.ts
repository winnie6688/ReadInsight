import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Article,
  Paragraph,
  KnowledgePoint,
  UserProgress,
  PracticeRecord,
  DiagnosisResult,
} from "@/types";

// ============================================================
// Store State 类型
// ============================================================

interface AppState {
  // 当前文章
  currentArticle: Article | null;
  setCurrentArticle: (article: Article | null) => void;

  // 文章列表（最近阅读）
  articles: Article[];
  addArticle: (article: Article) => void;
  updateArticle: (id: string, updates: Partial<Article>) => void;
  deleteArticle: (id: string) => void;

  // URL 输入历史记录
  urlHistory: Array<{ url: string; title: string; timestamp: number }>;
  addUrlHistory: (url: string, title: string) => void;
  clearUrlHistory: () => void;

  // 当前段落
  currentParagraph: Paragraph | null;
  setCurrentParagraph: (paragraph: Paragraph | null) => void;
  updateParagraph: (articleId: string, paragraphId: string, updates: Partial<Paragraph>) => void;

  // 诊断结果（当前练习）
  currentDiagnosis: DiagnosisResult | null;
  setCurrentDiagnosis: (diagnosis: DiagnosisResult | null) => void;

  // 知识点库
  knowledgePoints: KnowledgePoint[];
  addKnowledgePoints: (points: KnowledgePoint[]) => void;
  updateKnowledgePoint: (id: string, updates: Partial<KnowledgePoint>) => void;
  deleteKnowledgePoint: (id: string) => void;

  // 练习记录
  practiceRecords: PracticeRecord[];
  addPracticeRecord: (record: PracticeRecord) => void;

  // 用户进度
  progress: UserProgress;
  updateProgress: (updates: Partial<UserProgress>) => void;

  // UI 状态
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  loadingMessage: string;
  setLoadingMessage: (message: string) => void;

  // 重置
  reset: () => void;
}

// ============================================================
// 初始状态
// ============================================================

const initialProgress: UserProgress = {
  totalArticlesRead: 0,
  totalParagraphsPracticed: 0,
  totalKnowledgePoints: 0,
  masteredKnowledgePoints: 0,
  currentStreak: 0,
  totalMinutes: 0,
};

// ============================================================
// Store 实现
// ============================================================

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // 当前文章
      currentArticle: null,
      setCurrentArticle: (article) => set({ currentArticle: article }),

      // 文章列表
      articles: [],
      addArticle: (article) =>
        set((state) => ({
          articles: [article, ...state.articles].slice(0, 20), // 保留最近20篇
        })),
      updateArticle: (id, updates) =>
        set((state) => ({
          articles: state.articles.map((a) =>
            a.id === id ? { ...a, ...updates } : a
          ),
          currentArticle:
            state.currentArticle?.id === id
              ? { ...state.currentArticle, ...updates }
              : state.currentArticle,
        })),
      deleteArticle: (id) =>
        set((state) => ({
          articles: state.articles.filter((a) => a.id !== id),
          currentArticle:
            state.currentArticle?.id === id ? null : state.currentArticle,
        })),

      // URL 输入历史记录
      urlHistory: [],
      addUrlHistory: (url, title) =>
        set((state) => {
          // 如果已存在，先移除
          const filtered = state.urlHistory.filter((h) => h.url !== url);
          // 添加到最前面，保留最近 20 条
          return {
            urlHistory: [
              { url, title, timestamp: Date.now() },
              ...filtered,
            ].slice(0, 20),
          };
        }),
      clearUrlHistory: () => set({ urlHistory: [] }),

      // 当前段落
      currentParagraph: null,
      setCurrentParagraph: (paragraph) => set({ currentParagraph: paragraph }),
      updateParagraph: (articleId, paragraphId, updates) =>
        set((state) => {
          const updateParagraphInList = (article: Article): Article => ({
            ...article,
            paragraphs: article.paragraphs.map((p) =>
              p.id === paragraphId ? { ...p, ...updates } : p
            ),
          });

          return {
            articles: state.articles.map((a) =>
              a.id === articleId ? updateParagraphInList(a) : a
            ),
            currentArticle:
              state.currentArticle?.id === articleId
                ? updateParagraphInList(state.currentArticle)
                : state.currentArticle,
            currentParagraph:
              state.currentParagraph?.id === paragraphId
                ? { ...state.currentParagraph, ...updates }
                : state.currentParagraph,
          };
        }),

      // 诊断结果
      currentDiagnosis: null,
      setCurrentDiagnosis: (diagnosis) => set({ currentDiagnosis: diagnosis }),

      // 知识点库
      knowledgePoints: [],
      addKnowledgePoints: (points) =>
        set((state) => {
          const existingIds = new Set(state.knowledgePoints.map((kp) => kp.content));
          const newPoints = points.filter((p) => !existingIds.has(p.content));
          return {
            knowledgePoints: [...state.knowledgePoints, ...newPoints],
            progress: {
              ...state.progress,
              totalKnowledgePoints: state.progress.totalKnowledgePoints + newPoints.length,
            },
          };
        }),
      updateKnowledgePoint: (id, updates) =>
        set((state) => ({
          knowledgePoints: state.knowledgePoints.map((kp) =>
            kp.id === id ? { ...kp, ...updates } : kp
          ),
        })),
      deleteKnowledgePoint: (id) =>
        set((state) => {
          const deleted = state.knowledgePoints.find((kp) => kp.id === id);
          return {
            knowledgePoints: state.knowledgePoints.filter((kp) => kp.id !== id),
            progress: deleted
              ? {
                  ...state.progress,
                  totalKnowledgePoints:
                    state.progress.totalKnowledgePoints - 1,
                }
              : state.progress,
          };
        }),

      // 练习记录
      practiceRecords: [],
      addPracticeRecord: (record) =>
        set((state) => ({
          practiceRecords: [record, ...state.practiceRecords].slice(0, 100),
        })),

      // 用户进度
      progress: initialProgress,
      updateProgress: (updates) =>
        set((state) => ({
          progress: { ...state.progress, ...updates },
        })),

      // UI 状态
      isLoading: false,
      setIsLoading: (loading) => set({ isLoading: loading }),
      loadingMessage: "",
      setLoadingMessage: (message) => set({ loadingMessage: message }),

      // 重置
      reset: () =>
        set({
          currentArticle: null,
          currentParagraph: null,
          currentDiagnosis: null,
          progress: initialProgress,
        }),
    }),
    {
      name: "english-reading-store",
      partialize: (state) => ({
        articles: state.articles,
        knowledgePoints: state.knowledgePoints,
        practiceRecords: state.practiceRecords,
        progress: state.progress,
      }),
    }
  )
);

// ============================================================
// 辅助函数
// ============================================================

// 生成唯一 ID
export const generateId = (prefix: string = "id") =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// 计算文章阅读时间
export const calculateReadingTime = (wordCount: number) =>
  Math.ceil(wordCount / 200); // 按每分钟200词计算

// 计算单词数
export const calculateWordCount = (text: string) =>
  text.split(/\s+/).filter(Boolean).length;
