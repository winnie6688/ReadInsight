"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import type { Article } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Plus, Clock, FileText, Sparkles, ChevronRight, Trash2, Upload, History, X, Globe, File } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const { articles, progress, addArticle, setCurrentArticle, deleteArticle, setIsLoading, setLoadingMessage, urlHistory, addUrlHistory, clearUrlHistory } = useAppStore();

  const [inputMode, setInputMode] = useState<"url" | "paste" | "upload">("url");
  const [url, setUrl] = useState("");
  const [pasteContent, setPasteContent] = useState("");
  const [pasteTitle, setPasteTitle] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // 从历史记录选择
  const handleSelectFromHistory = (historyUrl: string) => {
    setUrl(historyUrl);
    setInputMode("url");
    setShowHistory(false);
  };

  // 解析文章
  const handleParseArticle = async () => {
    if (inputMode === "url" && !url.trim()) {
      alert("请输入文章 URL");
      return;
    }
    if (inputMode === "paste" && !pasteContent.trim()) {
      alert("请输入文章内容");
      return;
    }
    if (inputMode === "upload" && !uploadFile) {
      alert("请选择要上传的文件");
      return;
    }

    setIsLoading(true);
    setLoadingMessage("正在解析文章...");

    try {
      let response: Response;

      if (inputMode === "upload") {
        // 上传文件模式
        const formData = new FormData();
        formData.append("file", uploadFile!);

        response = await fetch("/api/article/upload", {
          method: "POST",
          body: formData,
        });
      } else {
        // URL 或粘贴模式
        response = await fetch("/api/article/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            inputMode === "url"
              ? { type: "url", url: url.trim() }
              : { type: "paste", title: pasteTitle.trim() || undefined, content: pasteContent.trim() }
          ),
        });
      }

      const result = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || "解析失败");
      }

      const article: Article = {
        ...result.data,
        sourceType: inputMode === "url" ? "url" : inputMode === "paste" ? "paste" : "upload",
        createdAt: Date.now(),
        status: "reading",
      };

      // URL 模式添加到历史记录
      if (inputMode === "url" && url.trim()) {
        addUrlHistory(url.trim(), article.title);
      }

      addArticle(article);
      setCurrentArticle(article);
      router.push(`/reading/${article.id}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "解析失败，请稍后重试");
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  // 处理文件选择
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    const validTypes = ["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!validTypes.includes(file.type)) {
      alert("仅支持 PDF 或图片文件（JPG、PNG、GIF、WebP）");
      return;
    }

    // 验证文件大小（最大 10MB）
    if (file.size > 10 * 1024 * 1024) {
      alert("文件大小不能超过 10MB");
      return;
    }

    setUploadFile(file);

    // 生成预览 URL
    if (file.type.startsWith("image/")) {
      setUploadPreview(URL.createObjectURL(file));
    } else {
      setUploadPreview(null);
    }
  };

  // 继续阅读
  const handleContinueReading = (article: Article) => {
    setCurrentArticle(article);
    router.push(`/reading/${article.id}`);
  };

  // 删除文章
  const handleDelete = (e: React.MouseEvent, articleId: string) => {
    e.stopPropagation();
    if (confirm("确定要删除这篇文章吗？")) {
      deleteArticle(articleId);
    }
  };

  // 格式化时间
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "今天";
    if (days === 1) return "昨天";
    if (days < 7) return `${days} 天前`;
    return date.toLocaleDateString("zh-CN");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--background)] via-[var(--primary-light)] to-[var(--background)]">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] flex items-center justify-center shadow-lg shadow-[var(--primary)]/20">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[var(--foreground)]">英文阅读教练</h1>
              <p className="text-xs text-[var(--muted-foreground)]">在阅读中提升英文</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--primary-light)] text-[var(--primary)] text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            智能识别薄弱点，个性化练习
          </div>
          <h2 className="text-4xl font-bold text-[var(--foreground)] mb-4">
            让英文阅读成为
            <span className="text-[var(--primary)]"> 你的超能力</span>
          </h2>
          <p className="text-lg text-[var(--muted-foreground)] max-w-2xl mx-auto">
            导入任何英文文章，AI 帮你识别薄弱点，生成针对性练习，
            <br className="hidden sm:block" />
            在真实阅读场景中稳步提升英文能力。
          </p>
        </div>

        {/* Input Section */}
        <Card className="mb-12 shadow-xl border-0 bg-white">
          <CardContent className="p-8">
            <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as "url" | "paste" | "upload")}>
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="url" className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  输入网址
                </TabsTrigger>
                <TabsTrigger value="paste" className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  粘贴文章
                </TabsTrigger>
                <TabsTrigger value="upload" className="flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  上传文件
                </TabsTrigger>
              </TabsList>

              <TabsContent value="url" className="space-y-4">
                <div className="flex gap-3">
                  <Input
                    placeholder="请输入英文文章网址，如 https://..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="flex-1 h-12 text-base"
                  />
                  <Button
                    onClick={handleParseArticle}
                    className="h-12 px-8 bg-[var(--primary)] hover:bg-[var(--primary-dark)] shadow-lg shadow-[var(--primary)]/20"
                  >
                    开始学习
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>

                {/* 历史记录 */}
                {urlHistory.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="w-4 h-4 text-[var(--muted-foreground)]" />
                      <span className="text-sm text-[var(--muted-foreground)]">最近访问</span>
                    </div>
                    <div className="space-y-2">
                      {urlHistory.slice(0, 5).map((item, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            setUrl(item.url);
                            setInputMode("url");
                          }}
                          className="w-full text-left p-3 rounded-lg border hover:bg-[var(--muted)]/50 transition-colors group"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-[var(--foreground)] truncate flex-1 mr-4 group-hover:text-[var(--primary)]">
                              {item.title || item.url}
                            </span>
                            <span className="text-xs text-[var(--muted-foreground)] whitespace-nowrap">
                              {formatTime(item.timestamp)}
                            </span>
                          </div>
                          <p className="text-xs text-[var(--muted-foreground)] truncate mt-1">
                            {item.url}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="paste" className="space-y-4">
                <Input
                  placeholder="文章标题（可选）"
                  value={pasteTitle}
                  onChange={(e) => setPasteTitle(e.target.value)}
                  className="h-11"
                />
                <Textarea
                  placeholder="请粘贴英文文章正文内容..."
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  className="min-h-[200px] text-base leading-relaxed"
                />
                <Button
                  onClick={handleParseArticle}
                  className="w-full h-12 bg-[var(--primary)] hover:bg-[var(--primary-dark)] shadow-lg shadow-[var(--primary)]/20"
                >
                  开始学习
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </TabsContent>

              <TabsContent value="upload" className="space-y-4">
                <div className="border-2 border-dashed border-[var(--border)] rounded-xl p-8 text-center hover:border-[var(--primary)] transition-colors">
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    accept=".pdf,image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleFileChange}
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer flex flex-col items-center gap-4"
                  >
                    {uploadPreview ? (
                      <div className="relative">
                        <img
                          src={uploadPreview}
                          alt="Preview"
                          className="max-h-40 rounded-lg shadow-md"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setUploadFile(null);
                            setUploadPreview(null);
                          }}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="w-16 h-16 rounded-full bg-[var(--primary-light)] flex items-center justify-center">
                          <Upload className="w-8 h-8 text-[var(--primary)]" />
                        </div>
                        <div>
                          <p className="text-[var(--foreground)] font-medium">
                            点击选择文件
                          </p>
                          <p className="text-sm text-[var(--muted-foreground)] mt-1">
                            支持 PDF、图片（JPG、PNG、GIF、WebP），最大 10MB
                          </p>
                        </div>
                      </>
                    )}
                    {uploadFile && (
                      <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                        <File className="w-4 h-4" />
                        <span>{uploadFile.name}</span>
                        <span>({(uploadFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                      </div>
                    )}
                  </label>
                </div>
                <Button
                  onClick={handleParseArticle}
                  disabled={!uploadFile}
                  className="w-full h-12 bg-[var(--primary)] hover:bg-[var(--primary-dark)] shadow-lg shadow-[var(--primary)]/20 disabled:opacity-50"
                >
                  开始学习
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Stats Section */}
        {progress.totalArticlesRead > 0 || progress.totalKnowledgePoints > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            <StatCard
              icon={<BookOpen className="w-5 h-5" />}
              value={progress.totalArticlesRead}
              label="已读文章"
              color="primary"
            />
            <StatCard
              icon={<FileText className="w-5 h-5" />}
              value={progress.totalParagraphsPracticed}
              label="练习段落"
              color="success"
            />
            <StatCard
              icon={<Sparkles className="w-5 h-5" />}
              value={progress.totalKnowledgePoints}
              label="知识点"
              color="warning"
            />
            <StatCard
              icon={<Clock className="w-5 h-5" />}
              value={progress.currentStreak}
              label="连续学习"
              color="destructive"
              suffix="天"
            />
          </div>
        ) : null}

        {/* Recent Articles */}
        {articles.length > 0 && (
          <div>
            <h3 className="text-xl font-bold text-[var(--foreground)] mb-6 flex items-center gap-2">
              <Clock className="w-5 h-5 text-[var(--muted-foreground)]" />
              最近阅读
            </h3>
            <div className="grid gap-4">
              {articles.slice(0, 5).map((article) => (
                <Card
                  key={article.id}
                  className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-1 border-0 bg-white"
                  onClick={() => handleContinueReading(article)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-[var(--foreground)] truncate mb-2">
                          {article.title}
                        </h4>
                        <div className="flex items-center gap-3 text-sm text-[var(--muted-foreground)]">
                          <span className="flex items-center gap-1">
                            <FileText className="w-4 h-4" />
                            {article.paragraphs.length} 段
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {formatTime(article.createdAt)}
                          </span>
                          {article.url && (
                            <Badge variant="secondary" className="text-xs">
                              URL
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleDelete(e, article.id)}
                          className="text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <ChevronRight className="w-5 h-5 text-[var(--muted-foreground)]" />
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-4">
                      <div className="h-2 bg-[var(--muted)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[var(--primary)] to-[var(--success)] rounded-full transition-all duration-500"
                          style={{
                            width: `${
                              article.paragraphs.filter((p) => p.status === "completed").length /
                              article.paragraphs.length *
                              100
                            }%`,
                          }}
                        />
                      </div>
                      <p className="text-xs text-[var(--muted-foreground)] mt-1">
                        {article.paragraphs.filter((p) => p.status === "completed").length} / {article.paragraphs.length} 段落已练习
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {articles.length === 0 && (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-[var(--primary-light)] flex items-center justify-center mx-auto mb-6">
              <BookOpen className="w-10 h-10 text-[var(--primary)]" />
            </div>
            <h3 className="text-xl font-semibold text-[var(--foreground)] mb-2">
              开始你的阅读之旅
            </h3>
            <p className="text-[var(--muted-foreground)]">
              输入一篇文章，让我们一起探索英文的奥秘
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t bg-white/50 mt-auto">
        <div className="max-w-5xl mx-auto px-6 py-6 text-center text-sm text-[var(--muted-foreground)]">
          在阅读中成长，在学习中进步
        </div>
      </footer>
    </div>
  );
}

// Stat Card Component
function StatCard({
  icon,
  value,
  label,
  color,
  suffix = "",
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  color: "primary" | "success" | "warning" | "destructive";
  suffix?: string;
}) {
  const colors = {
    primary: "bg-[var(--primary-light)] text-[var(--primary)]",
    success: "bg-[var(--success-light)] text-[var(--success)]",
    warning: "bg-[var(--warning-light)] text-[var(--warning)]",
    destructive: "bg-[var(--destructive-light)] text-[var(--destructive)]",
  };

  return (
    <Card className="border-0 bg-white">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors[color]}`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-[var(--foreground)]">
            {value}
            {suffix}
          </p>
          <p className="text-sm text-[var(--muted-foreground)]">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
