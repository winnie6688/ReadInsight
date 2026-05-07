import { NextRequest, NextResponse } from "next/server";
import { load } from "cheerio";
import { logger } from "@/lib/logger";
import type {
  Paragraph,
  ParseArticleRequest,
  ParseArticleResponse,
  ApiResponse,
} from "@/types";

// 生成唯一 ID
const generateId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// 计算单词数
const calculateWordCount = (text: string) =>
  text.split(/\s+/).filter(Boolean).length;

// 计算阅读时间（分钟）
const calculateReadingTime = (wordCount: number) => Math.ceil(wordCount / 200);

// 清理文本
const cleanText = (text: string) =>
  text
    .replace(/\s+/g, " ")
    .replace(/[\r\n]+/g, "\n")
    .trim();

// 提取段落
const extractParagraphs = (html: string): string[] => {
  const $ = load(html);
  const paragraphs: string[] = [];

  // 移除不需要的标签
  $("script, style, nav, footer, header, aside, noscript, iframe").remove();

  // 提取所有段落
  $("p, h1, h2, h3, h4, h5, h6").each((_, elem) => {
    const text = $(elem).text().trim();
    if (text && text.length > 20) {
      paragraphs.push(cleanText(text));
    }
  });

  // 如果没有找到，使用 body 内容
  if (paragraphs.length === 0) {
    const bodyText = $("body").text().trim();
    if (bodyText) {
      // 按句子分割
      const sentences = bodyText.split(/(?<=[.!?])\s+/);
      let currentParagraph = "";

      for (const sentence of sentences) {
        const trimmed = sentence.trim();
        if (!trimmed) continue;

        currentParagraph += (currentParagraph ? " " : "") + trimmed;

        // 如果段落足够长或者到了结尾，保存段落
        if (currentParagraph.length > 150 || sentence === sentences[sentences.length - 1]) {
          if (currentParagraph.length > 30) {
            paragraphs.push(currentParagraph);
          }
          currentParagraph = "";
        }
      }
    }
  }

  // 过滤过短或无效的段落
  return paragraphs.filter(
    (p) => p.length > 30 && !/^[\d\s.,!?;:]+$/.test(p)
  );
};

// 提取标题
const extractTitle = (html: string, url?: string): string => {
  const $ = load(html);

  // 尝试多种方式获取标题
  const title =
    $("h1").first().text().trim() ||
    $("meta[property='og:title']").attr("content")?.trim() ||
    $("title").text().trim() ||
    $("meta[name='title']").attr("content")?.trim();

  if (title) return title;

  // 如果有 URL，尝试从 URL 提取
  if (url) {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;
      const slug = path.split("/").pop() || "";
      if (slug) {
        return slug
          .replace(/[-_]/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
      }
    } catch {
      // URL 解析失败
    }
  }

  return "未命名文章";
};

// 解析 URL
async function parseUrl(url: string): Promise<{ title: string; paragraphs: string[] }> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const title = extractTitle(html, url);
    const paragraphs = extractParagraphs(html);

    return { title, paragraphs };
  } catch (error) {
    throw new Error(`URL 解析失败: ${error instanceof Error ? error.message : "未知错误"}`);
  }
}

// 解析粘贴内容
function parsePaste(title: string | undefined, content: string): { title: string; paragraphs: string[] } {
  const lines = content.split("\n").filter((l) => l.trim());

  // 使用提供的标题或第一行
  const articleTitle = title || lines[0]?.substring(0, 100) || "粘贴的文章";

  // 按段落分割
  const paragraphs: string[] = [];
  let currentParagraph = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // 如果是标题行（较短且不以标点结尾），开始新段落
    if (trimmed.length < 100 && /^[A-Z]/.test(trimmed) && !/[.!?]$/.test(trimmed)) {
      if (currentParagraph.length > 50) {
        paragraphs.push(currentParagraph);
      }
      currentParagraph = trimmed;
    } else {
      currentParagraph += (currentParagraph ? " " : "") + trimmed;
    }
  }

  // 保存最后一段
  if (currentParagraph.length > 30) {
    paragraphs.push(currentParagraph);
  }

  // 如果段落太少，合并短段落
  if (paragraphs.length < 3) {
    const merged: string[] = [];
    let buffer = "";

    for (const p of paragraphs) {
      buffer += (buffer ? "\n\n" : "") + p;
      if (buffer.length > 200 || p === paragraphs[paragraphs.length - 1]) {
        merged.push(buffer);
        buffer = "";
      }
    }

    return { title: articleTitle, paragraphs: merged.length > 0 ? merged : paragraphs };
  }

  return { title: articleTitle, paragraphs };
}

// POST /api/article/parse
export async function POST(request: NextRequest) {
  try {
    const body: ParseArticleRequest = await request.json();

    let title: string;
    let paragraphs: string[];

    if (body.type === "url" && body.url) {
      // URL 解析
      const result = await parseUrl(body.url);
      title = result.title;
      paragraphs = result.paragraphs;
    } else if (body.type === "paste" && body.content) {
      // 粘贴解析
      const result = parsePaste(body.title, body.content);
      title = result.title;
      paragraphs = result.paragraphs;
    } else {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: {
            code: "INVALID_PARAMS",
            message: "请提供 URL 或文章内容",
          },
        },
        { status: 400 }
      );
    }

    if (paragraphs.length === 0) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: {
            code: "PARSE_FAILED",
            message: "无法提取文章内容，请尝试手动粘贴",
          },
        },
        { status: 400 }
      );
    }

    // 创建文章对象
    const articleId = generateId("art");
    const wordCount = paragraphs.reduce((sum, p) => sum + calculateWordCount(p), 0);
    const readingTime = calculateReadingTime(wordCount);

    // 创建段落对象
    const paragraphObjects: Paragraph[] = paragraphs.map((content, index) => ({
      id: generateId("p"),
      articleId,
      index,
      content,
      status: "unread" as const,
    }));

    // 推荐段落（L2 难度左右的）
    const recommendedParagraphs = paragraphObjects
      .filter((p) => p.content.length > 80 && p.content.length < 400)
      .slice(0, 3)
      .map((p) => p.id);

    const response: ParseArticleResponse = {
      id: articleId,
      title,
      url: body.type === "url" ? body.url : undefined,
      paragraphs: paragraphObjects,
      wordCount,
      readingTime,
      recommendedParagraphs,
    };

    return NextResponse.json<ApiResponse<ParseArticleResponse>>({
      success: true,
      data: response,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`[${new Date().toISOString()}] Article parse error`, {
      error: errorMsg,
      type: error instanceof Error ? error.constructor.name : "Unknown"
    });
    console.error("Article parse error:", error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "文章解析失败，请稍后重试",
          details: errorMsg,
        },
      },
      { status: 500 }
    );
  }
}
