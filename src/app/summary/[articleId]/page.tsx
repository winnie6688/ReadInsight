"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Sparkles,
  BookOpen,
  Target,
  Trophy,
  ChevronRight,
  Clock,
  RefreshCw,
  CheckCircle,
  Lightbulb,
  Plus,
} from "lucide-react";
import type { PracticeQuestion, KnowledgePoint } from "@/types";

export default function SummaryPage() {
  const params = useParams();
  const router = useRouter();
  const {
    currentArticle,
    practiceRecords,
    knowledgePoints,
    progress,
    updateProgress,
  } = useAppStore();

  const [isGeneratingPractice, setIsGeneratingPractice] = useState(false);
  const [practiceQuestions, setPracticeQuestions] = useState<PracticeQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);


  const articleId = params.articleId as string;

  // 获取本文的练习记录
  const articleRecords = practiceRecords.filter((r) => r.articleId === articleId);
  const articleKnowledgePoints = knowledgePoints.filter(
    (kp) => kp.sourceArticleId === articleId
  );

  // 计算统计数据
  const totalParagraphs = currentArticle?.paragraphs.length || 0;
  const practicedParagraphs = articleRecords.length;
  const totalDuration = articleRecords.reduce((sum, r) => sum + r.duration, 0);
  const estimatedMinutes = Math.ceil(totalDuration / 60);

  // 生成练习题
  const handleGeneratePractice = async () => {
    if (articleKnowledgePoints.length === 0) {
      alert("暂无知识点可用于生成练习");
      return;
    }

    setIsGeneratingPractice(true);

    try {
      const response = await fetch("/api/practice/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          knowledgePoints: articleKnowledgePoints.slice(0, 5),
          count: 5,
        }),
      });

      const result = await response.json();

      if (result.success && result.data) {
        setPracticeQuestions(result.data.questions || []);
        setCurrentQuestionIndex(0);
        setSelectedAnswer(null);
        setShowResult(false);

      } else {
        throw new Error(result.error?.message || "生成失败");
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "生成练习失败");
    } finally {
      setIsGeneratingPractice(false);
    }
  };

  // 提交答案
  const handleSubmitAnswer = () => {
    if (!practiceQuestions[currentQuestionIndex] || selectedAnswer === null) return;

    const question = practiceQuestions[currentQuestionIndex];
    let isCorrect = false;

    if (question.type === "fill_blank") {
      isCorrect = selectedAnswer === question.correctAnswer;
    } else if (question.type === "match") {
      isCorrect = selectedAnswer === Object.keys(question.correctAnswers)[0];
    } else if (question.type === "judge") {
      isCorrect = selectedAnswer === (question.correctAnswer ? "true" : "false");
    } else if (question.type === "rewrite") {
      isCorrect = true; // rewrite 类型默认正确
    }

    setShowResult(true);
  };

  // 下一题
  const handleNextQuestion = () => {
    if (currentQuestionIndex < practiceQuestions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    }
  };

  // 完成练习
  const handleFinishPractice = () => {
    setPracticeQuestions([]);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setShowResult(false);

    // 更新已掌握知识点
    updateProgress({
      masteredKnowledgePoints: progress.masteredKnowledgePoints + 1,
    });
  };

  if (!currentArticle) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="text-center">
          <p className="text-[var(--muted-foreground)]">文章不存在</p>
          <Button variant="link" onClick={() => router.push("/")}>
            返回首页
          </Button>
        </div>
      </div>
    );
  }

  const currentQuestion = practiceQuestions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === practiceQuestions.length - 1;

  // 练习模式
  if (practiceQuestions.length > 0 && currentQuestion) {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        {/* Header */}
        <header className="bg-white border-b sticky top-0 z-50">
          <div className="max-w-2xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <h1 className="font-semibold text-[var(--foreground)]">即时练习</h1>
              <span className="text-sm text-[var(--muted-foreground)]">
                {currentQuestionIndex + 1} / {practiceQuestions.length}
              </span>
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-6 py-8">
          {/* Question Card */}
          <Card className="border-0 bg-white shadow-lg mb-6">
            <CardContent className="p-6">
              <Badge className="mb-4 bg-[var(--primary)] text-white">
                {currentQuestion.type === "fill_blank" && "选词填空"}
                {currentQuestion.type === "match" && "短语配对"}
                {currentQuestion.type === "judge" && "理解判断"}
                {currentQuestion.type === "rewrite" && "句式改写"}
              </Badge>

              <p className="text-lg text-[var(--foreground)] leading-relaxed mb-6">
                {currentQuestion.question}
              </p>

              {/* Fill Blank Options */}
              {currentQuestion.type === "fill_blank" && currentQuestion.options && (
                <div className="grid grid-cols-2 gap-3">
                  {currentQuestion.options.map((option, index) => (
                    <Button
                      key={index}
                      variant={selectedAnswer === option ? "default" : "outline"}
                      className={`h-12 justify-start ${
                        showResult
                          ? option === currentQuestion.correctAnswer
                            ? "bg-[var(--success)] hover:bg-[var(--success)]"
                            : selectedAnswer === option
                            ? "bg-[var(--destructive)] hover:bg-[var(--destructive)]"
                            : ""
                          : selectedAnswer === option
                          ? "bg-[var(--primary)]"
                          : ""
                      }`}
                      onClick={() => !showResult && setSelectedAnswer(option)}
                      disabled={showResult}
                    >
                      {option}
                    </Button>
                  ))}
                </div>
              )}

              {/* Match Pairs */}
              {currentQuestion.type === "match" && (
                <div className="space-y-3">
                  {currentQuestion.pairs.map((pair, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedAnswer === pair.phrase
                          ? "border-[var(--primary)] bg-[var(--primary-light)]"
                          : "border-[var(--border)] hover:border-[var(--primary)]/50"
                      }`}
                      onClick={() => !showResult && setSelectedAnswer(pair.phrase)}
                    >
                      <p className="font-medium text-[var(--foreground)]">{pair.phrase}</p>
                      <p className="text-sm text-[var(--muted-foreground)] mt-1">
                        {pair.meaning}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Judge Options */}
              {currentQuestion.type === "judge" && (
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant={selectedAnswer === "true" ? "default" : "outline"}
                    className={`h-12 ${
                      showResult
                        ? currentQuestion.correctAnswer === true
                          ? "bg-[var(--success)] hover:bg-[var(--success)]"
                          : selectedAnswer === "true"
                          ? "bg-[var(--destructive)] hover:bg-[var(--destructive)]"
                          : ""
                        : selectedAnswer === "true"
                        ? "bg-[var(--primary)]"
                        : ""
                    }`}
                    onClick={() => !showResult && setSelectedAnswer("true")}
                    disabled={showResult}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    正确
                  </Button>
                  <Button
                    variant={selectedAnswer === "false" ? "default" : "outline"}
                    className={`h-12 ${
                      showResult
                        ? currentQuestion.correctAnswer === false
                          ? "bg-[var(--success)] hover:bg-[var(--success)]"
                          : selectedAnswer === "false"
                          ? "bg-[var(--destructive)] hover:bg-[var(--destructive)]"
                          : ""
                        : selectedAnswer === "false"
                        ? "bg-[var(--primary)]"
                        : ""
                    }`}
                    onClick={() => !showResult && setSelectedAnswer("false")}
                    disabled={showResult}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    错误
                  </Button>
                </div>
              )}

              {/* Result Feedback */}
              {showResult && (
                <div className="mt-6 p-4 bg-[var(--primary-light)] rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    {(() => {
                      let isCorrect = false;
                      if (currentQuestion.type === "fill_blank") {
                        isCorrect = selectedAnswer === currentQuestion.correctAnswer;
                      } else if (currentQuestion.type === "judge") {
                        isCorrect = selectedAnswer === (currentQuestion.correctAnswer ? "true" : "false");
                      }
                      return isCorrect ? (
                        <>
                          <CheckCircle className="w-5 h-5 text-[var(--success)]" />
                          <span className="font-medium text-[var(--success)]">回答正确！</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-5 h-5 text-[var(--destructive)]" />
                          <span className="font-medium text-[var(--destructive)]">回答错误</span>
                        </>
                      );
                    })()}
                  </div>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {currentQuestion.explanation}
                  </p>
                  {currentQuestion.type === "judge" && "commonMistake" in currentQuestion && currentQuestion.commonMistake && (
                    <p className="text-sm text-[var(--warning)] mt-2">
                      常见错误: {currentQuestion.commonMistake}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4">
            {!showResult ? (
              <Button
                onClick={handleSubmitAnswer}
                disabled={selectedAnswer === null}
                className="flex-1 bg-[var(--primary)] hover:bg-[var(--primary-dark)]"
              >
                提交答案
              </Button>
            ) : (
              <Button
                onClick={isLastQuestion ? handleFinishPractice : handleNextQuestion}
                className="flex-1 bg-[var(--primary)] hover:bg-[var(--primary-dark)]"
              >
                {isLastQuestion ? "完成练习" : "下一题"}
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </main>
      </div>
    );
  }

  // 总结模式
  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--background)] via-[var(--primary-light)] to-[var(--background)]">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/reading/${articleId}`)}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            返回
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--success)] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-[var(--primary)]/20">
            <Trophy className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">
            学习完成！
          </h1>
          <p className="text-[var(--muted-foreground)]">
            你已完成了「{currentArticle.title}」的学习
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <Card className="border-0 bg-white shadow-lg">
            <CardContent className="p-5 text-center">
              <div className="w-12 h-12 rounded-full bg-[var(--primary-light)] flex items-center justify-center mx-auto mb-3">
                <BookOpen className="w-6 h-6 text-[var(--primary)]" />
              </div>
              <p className="text-2xl font-bold text-[var(--foreground)]">{practicedParagraphs}</p>
              <p className="text-sm text-[var(--muted-foreground)]">练习段落</p>
            </CardContent>
          </Card>
          <Card className="border-0 bg-white shadow-lg">
            <CardContent className="p-5 text-center">
              <div className="w-12 h-12 rounded-full bg-[var(--warning-light)] flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-6 h-6 text-[var(--warning)]" />
              </div>
              <p className="text-2xl font-bold text-[var(--foreground)]">{articleKnowledgePoints.length}</p>
              <p className="text-sm text-[var(--muted-foreground)]">新知识点</p>
            </CardContent>
          </Card>
          <Card className="border-0 bg-white shadow-lg">
            <CardContent className="p-5 text-center">
              <div className="w-12 h-12 rounded-full bg-[var(--destructive-light)] flex items-center justify-center mx-auto mb-3">
                <Clock className="w-6 h-6 text-[var(--destructive)]" />
              </div>
              <p className="text-2xl font-bold text-[var(--foreground)]">{estimatedMinutes || 1}</p>
              <p className="text-sm text-[var(--muted-foreground)]">分钟</p>
            </CardContent>
          </Card>
        </div>

        {/* Knowledge Points */}
        {articleKnowledgePoints.length > 0 && (
          <Card className="mb-8 border-0 bg-white shadow-lg">
            <CardContent className="p-6">
              <h2 className="font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-[var(--warning)]" />
                本次知识点
              </h2>
              <div className="space-y-3">
                {articleKnowledgePoints.slice(0, 10).map((kp) => {
                  const typeColors = {
                    word: "bg-[var(--level-1-bg)] text-[var(--level-1)]",
                    phrase: "bg-[var(--level-2-bg)] text-[var(--level-2)]",
                    pattern: "bg-[var(--level-3-bg)] text-[var(--level-3)]",
                    comprehension_point: "bg-[var(--level-4-bg)] text-[var(--level-4)]",
                  };
                  const typeLabels = {
                    word: "单词",
                    phrase: "词组",
                    pattern: "句式",
                    comprehension_point: "理解",
                  };

                  return (
                    <div
                      key={kp.id}
                      className="p-3 bg-[var(--muted)]/50 rounded-lg"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={`${typeColors[kp.type]} text-xs`}>
                          {typeLabels[kp.type]}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {kp.difficulty}
                        </Badge>
                      </div>
                      <p className="font-medium text-[var(--foreground)]">
                        {kp.content}
                      </p>
                      <p className="text-sm text-[var(--primary)]">
                        {kp.meaning}
                      </p>
                    </div>
                  );
                })}
              </div>
              {articleKnowledgePoints.length > 10 && (
                <p className="text-sm text-[var(--muted-foreground)] mt-3 text-center">
                  还有 {articleKnowledgePoints.length - 10} 个知识点...
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="space-y-4">
          {articleKnowledgePoints.length > 0 && (
            <Button
              onClick={handleGeneratePractice}
              disabled={isGeneratingPractice}
              className="w-full h-12 bg-[var(--primary)] hover:bg-[var(--primary-dark)] gap-2"
            >
              {isGeneratingPractice ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  生成练习中...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  基于本次知识点生成练习
                </>
              )}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => router.push("/")}
            className="w-full h-12"
          >
            返回首页
          </Button>
        </div>
      </main>
    </div>
  );
}

// XCircle Icon
function XCircle({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  );
}
