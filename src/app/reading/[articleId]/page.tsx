"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  BookOpen,
  FileText,
  ChevronRight,
  Sparkles,
  FileTextIcon,
} from "lucide-react";

export default function ReadingPage() {
  const params = useParams();
  const router = useRouter();
  const { articles, currentArticle, setCurrentArticle, setCurrentParagraph, setIsLoading, setLoadingMessage } = useAppStore();

  const articleId = params.articleId as string;

  // 获取文章
  useEffect(() => {
    const article = articles.find((a) => a.id === articleId);
    if (article) {
      setCurrentArticle(article);
    } else if (currentArticle?.id === articleId) {
      // 已在 store 中
    } else {
      // 文章不存在，返回首页
      router.push("/");
    }
  }, [articleId, articles, currentArticle, setCurrentArticle, router]);

  if (!currentArticle) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[var(--muted-foreground)]">加载中...</p>
        </div>
      </div>
    );
  }

  // 开始练习
  const handleStartPractice = (paragraphId: string) => {
    const paragraph = currentArticle.paragraphs.find((p) => p.id === paragraphId);
    if (paragraph) {
      setCurrentParagraph(paragraph);
      router.push(`/practice/${paragraphId}`);
    }
  };

  // 前往总结页
  const handleGoToSummary = () => {
    router.push(`/summary/${articleId}`);
  };

  // 统计数据
  const totalParagraphs = currentArticle.paragraphs.length;
  const completedParagraphs = currentArticle.paragraphs.filter(
    (p) => p.status === "completed"
  ).length;


  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/")}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                返回
              </Button>
              <div className="h-6 w-px bg-[var(--border)]" />
              <h1 className="font-semibold text-[var(--foreground)] truncate max-w-[300px]">
                {currentArticle.title}
              </h1>
            </div>
            {completedParagraphs > 0 && (
              <Button
                onClick={handleGoToSummary}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                查看总结
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Article Info */}
        <Card className="mb-8 border-0 bg-gradient-to-r from-[var(--primary-light)] to-white shadow-lg">
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                <FileText className="w-4 h-4" />
                <span>{totalParagraphs} 段落</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Summary */}
        {currentArticle.aiSummary && (
          <Card className="mb-8 border-0 bg-gradient-to-br from-[var(--primary-light)]/50 to-white shadow-md">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--primary)]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4 text-[var(--primary)]" />
                </div>
                <div>
                  <h3 className="font-medium text-[var(--foreground)] mb-2">文章概要</h3>
                  <p className="text-[var(--muted-foreground)] leading-relaxed">
                    {currentArticle.aiSummary}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}


        {/* Paragraphs List */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-[var(--foreground)] flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[var(--muted-foreground)]" />
            选择段落练习
          </h2>

          {currentArticle.paragraphs.map((paragraph, index) => {
            return (
              <Card
                key={paragraph.id}
                className={`cursor-pointer hover:shadow-lg transition-all duration-200 border-0 ${
                  paragraph.status === "completed"
                    ? "bg-[var(--success-light)]/30"
                    : paragraph.status === "in_progress"
                    ? "bg-[var(--warning-light)]/30"
                    : "bg-white hover:-translate-y-1"
                }`}
                onClick={() => {
                  if (paragraph.status !== "completed") {
                    handleStartPractice(paragraph.id);
                  }
                }}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Header */}
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-sm font-medium text-[var(--muted-foreground)]">
                          段落 {index + 1}
                        </span>

                        {/* Status Badge */}
                        {paragraph.status === "completed" && (
                          <Badge className="bg-[var(--success)] text-white">
                            已完成
                          </Badge>
                        )}
                        {paragraph.status === "in_progress" && (
                          <Badge className="bg-[var(--warning)] text-white">
                            进行中
                          </Badge>
                        )}
                      </div>

                      {/* Content Preview */}
                      <p className="text-[var(--foreground)] leading-relaxed line-clamp-3">
                        {paragraph.content}
                      </p>

                      {/* User Translation Preview */}
                      {paragraph.userTranslation && (
                        <div className="mt-3 p-3 bg-[var(--muted)] rounded-lg">
                          <p className="text-sm text-[var(--muted-foreground)] mb-1">
                            你的翻译：
                          </p>
                          <p className="text-sm text-[var(--foreground)] line-clamp-2">
                            {paragraph.userTranslation}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Action */}
                    {paragraph.status !== "completed" && (
                      <div className="flex-shrink-0">
                        <ChevronRight className="w-5 h-5 text-[var(--muted-foreground)]" />
                      </div>
                    )}
                    {paragraph.status === "completed" && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--success)] flex items-center justify-center">
                        <span className="text-white text-sm">✓</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Summary Button */}
        {completedParagraphs > 0 && (
          <div className="mt-8 text-center">
            <Button
              onClick={handleGoToSummary}
              variant="outline"
              className="gap-2 px-8"
            >
              <Sparkles className="w-4 h-4" />
              查看本次学习总结
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
