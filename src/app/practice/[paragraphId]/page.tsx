"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  ArrowLeft,
  Send,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  XCircle,
  AlertCircle,
  Lightbulb,
  BookOpen,
  Plus,
  RefreshCw,
  Loader2,
} from "lucide-react";
import type { KnowledgePoint, DiagnosisResult } from "@/types";

type Step = "input" | "result";

export default function PracticePage() {
  const params = useParams();
  const router = useRouter();
  const {
    currentArticle,
    updateParagraph,
    setCurrentDiagnosis,
    addKnowledgePoints,
    addPracticeRecord,
    updateProgress,
  } = useAppStore();

  const [step, setStep] = useState<Step>("input");
  const [userTranslation, setUserTranslation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [diagnosisResult, setDiagnosisResult] = useState<DiagnosisResult | null>(null);
  const [selectedPoints, setSelectedPoints] = useState<Set<string>>(new Set());
  const [isSavingKnowledge, setIsSavingKnowledge] = useState(false);
  const [practiceStartTime] = useState(Date.now());

  const paragraphId = params.paragraphId as string;

  // 获取当前段落
  const currentParagraph = currentArticle?.paragraphs.find((p) => p.id === paragraphId);
  const paragraphIndex = currentArticle?.paragraphs.findIndex((p) => p.id === paragraphId) ?? -1;

  // 跳转到下一页
  const goToNextParagraph = () => {
    if (!currentArticle || paragraphIndex === -1) return;

    const nextIndex = paragraphIndex + 1;
    if (nextIndex < currentArticle.paragraphs.length) {
      const nextParagraph = currentArticle.paragraphs[nextIndex];
      router.push(`/practice/${nextParagraph.id}`);
    } else {
      // 所有段落已完成，返回总结页
      router.push(`/summary/${currentArticle.id}`);
    }
  };

  // 跳转到上一页
  const goToPrevParagraph = () => {
    if (!currentArticle || paragraphIndex === -1) return;

    const prevIndex = paragraphIndex - 1;
    if (prevIndex >= 0) {
      const prevParagraph = currentArticle.paragraphs[prevIndex];
      router.push(`/practice/${prevParagraph.id}`);
    }
  };

  // 提交翻译
  const handleSubmit = async () => {
    if (!currentParagraph || !currentArticle || !userTranslation.trim()) return;

    setIsSubmitting(true);
    setIsAnalyzing(true);
    setAnalysisProgress(0);

    try {
      // 模拟分析进度
      const progressInterval = setInterval(() => {
        setAnalysisProgress((prev) => Math.min(prev + 10, 90));
      }, 300);

      const response = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId: currentArticle.id,
          paragraphId: currentParagraph.id,
          originalParagraph: currentParagraph.content,
          userTranslation: userTranslation.trim(),
        }),
      });

      clearInterval(progressInterval);
      setAnalysisProgress(100);

      const result = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || "分析失败");
      }

      // 更新段落状态和翻译
      updateParagraph(currentArticle.id, currentParagraph.id, {
        status: "completed",
        userTranslation: userTranslation.trim(),
        aiTranslation: result.data.aiTranslation,
      });

      // 更新诊断结果
      setDiagnosisResult(result.data);
      setCurrentDiagnosis(result.data);

      // 预选所有知识点
      const pointsIds = result.data.knowledgePoints.map((_: unknown, i: number) => `kp_new_${i}`);
      setSelectedPoints(new Set(pointsIds));

      // 添加练习记录
      const practiceRecord = {
        id: `rec_${Date.now()}`,
        articleId: currentArticle.id,
        articleTitle: currentArticle.title,
        paragraphId: currentParagraph.id,
        paragraphIndex: paragraphIndex,
        paragraphContent: currentParagraph.content,
        userTranslation: userTranslation.trim(),
        aiTranslation: result.data.aiTranslation,
        knowledgePoints: result.data.knowledgePoints.map((kp: KnowledgePoint) => kp.content),
        duration: Math.round((Date.now() - practiceStartTime) / 1000),
        practicedAt: Date.now(),
      };
      addPracticeRecord(practiceRecord);

      // 更新进度
      updateProgress({
        totalParagraphsPracticed: (useAppStore.getState().progress.totalParagraphsPracticed || 0) + 1,
      });

      setStep("result");
    } catch (error) {
      alert(error instanceof Error ? error.message : "分析失败，请稍后重试");
    } finally {
      setIsSubmitting(false);
      setIsAnalyzing(false);
    }
  };

  // 添加知识点到知识库
  const handleAddToKnowledgeBase = async () => {
    if (!diagnosisResult || !currentArticle || !currentParagraph || isSavingKnowledge) return;

    const newPoints: KnowledgePoint[] = diagnosisResult.knowledgePoints
      .filter((_, index) => selectedPoints.has(`kp_new_${index}`))
      .map((kp, index) => ({
        ...kp,
        id: `kp_${Date.now()}_${index}`,
        sourceArticleId: currentArticle.id,
        sourceArticleTitle: currentArticle.title,
        createdAt: Date.now(),
      }));

    if (newPoints.length > 0) {
      setIsSavingKnowledge(true);

      try {
        const response = await fetch("/api/knowledge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            articleId: currentArticle.id,
            articleTitle: currentArticle.title,
            paragraphId: currentParagraph.id,
            points: newPoints,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          const savedPoints = result.data?.points || newPoints;

          addKnowledgePoints(savedPoints);
          setSelectedPoints(new Set());
          toast.success(`已成功存入 ${savedPoints.length} 个知识点到知识库`, {
            description: "可在知识库页面查看和管理",
          });
        } else {
          const error = await response.json();
          // 检查是否为数据库未配置错误
          const isDbNotConfigured = response.status === 503 || 
            error.error?.includes("数据库") || 
            error.error?.includes("DATABASE");
          
          toast.error("存入知识库失败", {
            description: isDbNotConfigured 
              ? "知识库功能暂不可用，请联系管理员配置数据库" 
              : error.error || error.message || "请稍后重试",
          });
        }
      } catch (error) {
        console.error("存入知识库失败:", error);
        toast.error("存入知识库失败", {
          description: "网络错误，请检查网络连接",
        });
      } finally {
        setIsSavingKnowledge(false);
      }
    } else {
      toast.error("请先选择要存入的知识点", {
        description: "勾选知识点后再点击存入知识库",
      });
    }
  };

  // 切换知识点选择
  const togglePointSelection = (index: number) => {
    const id = `kp_new_${index}`;
    setSelectedPoints((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  if (!currentParagraph || !currentArticle) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="text-center">
          <p className="text-[var(--muted-foreground)]">段落不存在</p>
          <Button variant="link" onClick={() => router.push("/")}>
            返回首页
          </Button>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/reading/${currentArticle.id}`)}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                返回
              </Button>
              <div className="h-6 w-px bg-[var(--border)]" />
              <span className="text-sm text-[var(--muted-foreground)]">
                段落 {paragraphIndex + 1} / {currentArticle.paragraphs.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {paragraphIndex > 0 && (
                <Button variant="ghost" size="sm" onClick={goToPrevParagraph}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              )}
              {paragraphIndex < currentArticle.paragraphs.length - 1 && step === "result" && (
                <Button variant="ghost" size="sm" onClick={goToNextParagraph}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
          <div className="mt-3">
            <Progress
              value={((paragraphIndex + (step === "result" ? 1 : 0)) / currentArticle.paragraphs.length) * 100}
              className="h-1"
            />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Original Text */}
        <Card className="mb-6 border-0 bg-white shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <BookOpen className="w-5 h-5 text-[var(--primary)]" />
              <span className="font-medium text-[var(--foreground)]">原文</span>
            </div>
            <p className="text-lg leading-relaxed text-[var(--foreground)] font-serif">
              {currentParagraph.content}
            </p>
          </CardContent>
        </Card>

        {/* Step 1: Translation Input */}
        {step === "input" && (
          <Card className="border-0 bg-white shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <PenIcon className="w-5 h-5 text-[var(--primary)]" />
                <span className="font-medium text-[var(--foreground)]">请输入你的翻译</span>
              </div>
              <Textarea
                placeholder="尝试翻译上面的英文段落，即使不确定也可以试试..."
                value={userTranslation}
                onChange={(e) => setUserTranslation(e.target.value)}
                className="min-h-[200px] text-base leading-relaxed mb-4"
              />
              <div className="flex items-center justify-between">
                <p className="text-sm text-[var(--muted-foreground)]">
                  {userTranslation.length} 字
                </p>
                <Button
                  onClick={handleSubmit}
                  disabled={!userTranslation.trim() || isSubmitting}
                  className="bg-[var(--primary)] hover:bg-[var(--primary-dark)] gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {isAnalyzing ? "AI 分析中..." : "提交中..."}
                    </>
                  ) : (
                    <>
                      提交翻译
                      <Send className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>

              {/* Analysis Progress */}
              {isAnalyzing && (
                <div className="mt-6 p-4 bg-[var(--primary-light)] rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[var(--primary)]" />
                    <span className="text-sm font-medium text-[var(--primary)]">
                      AI 正在分析你的翻译...
                    </span>
                  </div>
                  <Progress value={analysisProgress} className="h-1" />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 2: Result */}
        {step === "result" && diagnosisResult && (
          <div className="space-y-6">
            {/* Translation Comparison - 5:5 Split */}
            <div className="grid grid-cols-2 gap-4">
              {/* User Translation */}
              <Card className="border-0 bg-gradient-to-r from-[var(--primary-light)]/30 to-white shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <PenIcon className="w-5 h-5 text-[var(--primary)]" />
                    <span className="font-medium text-[var(--foreground)]">你的翻译</span>
                  </div>
                  <p className="text-base leading-relaxed text-[var(--foreground)]">
                    {userTranslation}
                  </p>
                </CardContent>
              </Card>

              {/* AI Translation */}
              <Card className="border-0 bg-gradient-to-r from-[var(--success-light)]/50 to-white shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Lightbulb className="w-5 h-5 text-[var(--success)]" />
                    <span className="font-medium text-[var(--foreground)]">AI 参考翻译</span>
                  </div>
                  <p className="text-base leading-relaxed text-[var(--foreground)]">
                    {diagnosisResult.aiTranslation}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Analysis */}
            <Card className="border-0 bg-white shadow-lg">
              <CardContent className="p-6">
                <h3 className="font-medium text-[var(--foreground)] mb-4 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-[var(--primary)]" />
                  翻译分析
                </h3>

                {/* Correct Parts */}
                {diagnosisResult.analysis.correct.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle className="w-4 h-4 text-[var(--success)]" />
                      <span className="font-medium text-[var(--success)]">理解正确</span>
                    </div>
                    <div className="space-y-2">
                      {diagnosisResult.analysis.correct.map((item, index) => (
                        <div
                          key={index}
                          className="p-3 bg-[var(--success-light)]/30 rounded-lg border-l-4 border-[var(--success)]"
                        >
                          <p className="font-medium text-[var(--foreground)] mb-1">
                            &quot;{item.text}&quot;
                          </p>
                          <p className="text-sm text-[var(--muted-foreground)]">
                            {item.feedback}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Alternative Parts */}
                {diagnosisResult.analysis.alternative.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <RefreshCw className="w-4 h-4 text-[var(--warning)]" />
                      <span className="font-medium text-[var(--warning)]">表达可优化</span>
                    </div>
                    <div className="space-y-2">
                      {diagnosisResult.analysis.alternative.map((item, index) => (
                        <div
                          key={index}
                          className="p-3 bg-[var(--warning-light)]/30 rounded-lg border-l-4 border-[var(--warning)]"
                        >
                          <p className="text-sm text-[var(--muted-foreground)] mb-1">
                            原文: <span className="text-[var(--foreground)]">{item.original}</span>
                          </p>
                          <p className="text-sm text-[var(--muted-foreground)] mb-1">
                            你的翻译: <span className="text-[var(--foreground)]">{item.yourTranslation}</span>
                          </p>
                          <p className="text-sm text-[var(--muted-foreground)]">
                            更好的表达: <span className="text-[var(--success)] font-medium">{item.betterTranslation}</span>
                          </p>
                          <p className="text-sm text-[var(--muted-foreground)] mt-1 italic">
                            {item.reason}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Missed Parts */}
                {diagnosisResult.analysis.missed.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <XCircle className="w-4 h-4 text-[var(--destructive)]" />
                      <span className="font-medium text-[var(--destructive)]">遗漏要点</span>
                    </div>
                    <div className="space-y-2">
                      {diagnosisResult.analysis.missed.map((item, index) => (
                        <div
                          key={index}
                          className="p-3 bg-[var(--destructive-light)]/30 rounded-lg border-l-4 border-[var(--destructive)]"
                        >
                          <p className="font-medium text-[var(--foreground)] mb-1">
                            &quot;{item.text}&quot;
                          </p>
                          <p className="text-sm text-[var(--muted-foreground)] mb-1">
                            含义: {item.meaning}
                          </p>
                          <p className="text-sm text-[var(--muted-foreground)] italic">
                            {item.reason}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Knowledge Points */}
            {diagnosisResult.knowledgePoints.length > 0 && (
              <Card className="border-0 bg-white shadow-lg">
                <CardContent className="p-6">
                  <h3 className="font-medium text-[var(--foreground)] mb-4 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-[var(--primary)]" />
                    本次知识点 ({diagnosisResult.knowledgePoints.length})
                  </h3>
                  <div className="space-y-3">
                    {diagnosisResult.knowledgePoints.map((kp, index) => {
                      const isSelected = selectedPoints.has(`kp_new_${index}`);
                      const typeIcons = {
                        word: <BookOpen className="w-4 h-4" />,
                        phrase: <Plus className="w-4 h-4" />,
                        pattern: <RefreshCw className="w-4 h-4" />,
                        comprehension_point: <Lightbulb className="w-4 h-4" />,
                      };
                      const typeLabels = {
                        word: "单词",
                        phrase: "词组",
                        pattern: "句式",
                        comprehension_point: "理解",
                      };
                      const typeColors = {
                        word: "bg-[var(--level-1-bg)] text-[var(--level-1)]",
                        phrase: "bg-[var(--level-2-bg)] text-[var(--level-2)]",
                        pattern: "bg-[var(--level-3-bg)] text-[var(--level-3)]",
                        comprehension_point: "bg-[var(--level-4-bg)] text-[var(--level-4)]",
                      };

                      return (
                        <div
                          key={index}
                          className={`p-4 rounded-lg border cursor-pointer transition-all ${
                            isSelected
                              ? "border-[var(--primary)] bg-[var(--primary-light)]/50"
                              : "border-[var(--border)] hover:border-[var(--primary)]/50"
                          }`}
                          onClick={() => togglePointSelection(index)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge className={typeColors[kp.type]}>
                                  {typeIcons[kp.type]}
                                  <span className="ml-1">{typeLabels[kp.type]}</span>
                                </Badge>
                                <Badge variant="outline">{kp.difficulty}</Badge>
                              </div>
                              <p className="font-medium text-[var(--foreground)] mb-1">
                                {kp.content}
                              </p>
                              <p className="text-sm text-[var(--primary)] mb-1">
                                {kp.meaning}
                              </p>
                              {kp.explanation && (
                                <p className="text-sm text-[var(--muted-foreground)]">
                                  {kp.explanation}
                                </p>
                              )}
                            </div>
                            <div
                              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                isSelected
                                  ? "border-[var(--primary)] bg-[var(--primary)]"
                                  : "border-[var(--border)]"
                              }`}
                            >
                              {isSelected && (
                                <CheckCircle className="w-4 h-4 text-white" />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <Button
                    onClick={handleAddToKnowledgeBase}
                    className="w-full mt-4 bg-[var(--primary)] hover:bg-[var(--primary-dark)]"
                    disabled={selectedPoints.size === 0 || isSavingKnowledge}
                  >
                    {isSavingKnowledge ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4 mr-2" />
                    )}
                    {isSavingKnowledge ? "正在存入知识库..." : `添加 ${selectedPoints.size} 个知识点到知识库`}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={() => {
                  setStep("input");
                  setUserTranslation("");
                  setDiagnosisResult(null);
                  setSelectedPoints(new Set());
                }}
                className="flex-1"
              >
                重新翻译
              </Button>
              <Button
                onClick={goToNextParagraph}
                className="flex-1 bg-[var(--primary)] hover:bg-[var(--primary-dark)]"
              >
                {paragraphIndex < currentArticle.paragraphs.length - 1 ? (
                  <>
                    下一段
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </>
                ) : (
                  <>
                    查看总结
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Pen Icon Component
function PenIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}
