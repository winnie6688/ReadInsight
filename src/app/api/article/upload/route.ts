import { NextRequest, NextResponse } from "next/server";
import { LLMClient, Config } from "coze-coding-dev-sdk";
import { logger } from "@/lib/logger";
import fs from "fs";
import path from "path";

// 生成唯一 ID
const generateId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// 计算单词数
const calculateWordCount = (text: string) =>
  text.split(/\s+/).filter(Boolean).length;

// 计算阅读时间（分钟）
const calculateReadingTime = (wordCount: number) => Math.ceil(wordCount / 200);

// 临时文件目录
const TEMP_DIR = "/tmp/uploads";

// 确保临时目录存在
function ensureTempDir() {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
}

// 从图片提取文字
async function extractTextFromImage(filePath: string): Promise<string> {
  const client = new LLMClient(new Config());

  const imageUrl = `file://${filePath}`;
  const messages = [
    {
      role: "user" as const,
      content: [
        { type: "text" as const, text: "请识别并提取这张图片中的所有英文文字内容，保持原有段落结构。如果图片中不是英文文章或无法识别，请说明情况。" },
        { type: "image_url" as const, image_url: { url: imageUrl } },
      ],
    },
  ];

  const response = await client.invoke(messages);
  return response.content?.toString() || "";
}

// 从 PDF 提取文字（使用内置 SDK 的文档解析）
async function extractTextFromPDF(filePath: string): Promise<string> {
  // 尝试使用 fetch-url 功能
  try {
    const { FetchClient, Config: FetchConfig } = await import("coze-coding-dev-sdk");
    const fetchClient = new FetchClient(new FetchConfig());
    
    // 使用 file:// 协议
    const fileUrl = `file://${filePath}`;
    const response = await fetchClient.fetch(fileUrl);
    
    if (response.status_code === 0) {
      const textContent = response.content
        .filter((item: { type: string; text?: string }) => item.type === "text")
        .map((item: { text?: string }) => item.text || "")
        .join("\n")
        .trim();
      
      if (textContent) {
        return textContent;
      }
    }
  } catch (error) {
    logger.warn("FetchClient PDF 解析失败", { error: String(error) });
  }

  return "";
}

// 处理文本分割成段落
function splitIntoParagraphs(text: string): string[] {
  // 清理文本
  const cleaned = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/\u00A0/g, " ")  // 不间断空格
    .replace(/\u2002/g, " ")  // en space
    .replace(/\u2003/g, " ")  // em space
    .trim();

  // 按段落分割
  const paragraphs = cleaned.split(/\n{2,}/);
  
  // 进一步处理短段落
  const result: string[] = [];
  let buffer = "";

  for (const p of paragraphs) {
    const trimmed = p.trim().replace(/\n/g, " ");
    if (!trimmed) continue;

    if (trimmed.length > 100) {
      if (buffer) {
        result.push(buffer.trim());
        buffer = "";
      }
      result.push(trimmed);
    } else {
      buffer += (buffer ? " " : "") + trimmed;
      if (buffer.length > 150) {
        result.push(buffer.trim());
        buffer = "";
      }
    }
  }

  if (buffer) {
    result.push(buffer.trim());
  }

  // 过滤过短或无效的段落
  return result.filter(
    (p) => p.length > 30 && !/^[\d\s.,!?;:()\-]+$/.test(p)
  );
}

// POST /api/article/upload
export async function POST(request: NextRequest) {
  ensureTempDir();
  let tempFilePath: string | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_PARAMS",
            message: "请选择要上传的文件",
          },
        },
        { status: 400 }
      );
    }

    // 验证文件类型
    const validTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_FILE_TYPE",
            message: "仅支持 PDF 或图片文件（JPG、PNG、GIF、WebP）",
          },
        },
        { status: 400 }
      );
    }

    // 保存文件
    const ext = file.name.split(".").pop() || (file.type === "application/pdf" ? "pdf" : "jpg");
    const tempFileName = `${generateId("upload")}.${ext}`;
    tempFilePath = path.join(TEMP_DIR, tempFileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(tempFilePath, buffer);

    logger.info("文件上传成功", {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    });

    // 提取文字
    let extractedText = "";
    const isPdf = file.type === "application/pdf";

    if (isPdf) {
      extractedText = await extractTextFromPDF(tempFilePath);
    } else {
      extractedText = await extractTextFromImage(tempFilePath);
    }

    if (!extractedText || extractedText.trim().length < 50) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "EXTRACT_FAILED",
            message: isPdf
              ? "无法从 PDF 中提取文字内容，请确保 PDF 包含可搜索的文字而非扫描图片"
              : "无法从图片中识别文字内容，请确保图片清晰且包含英文文字",
          },
        },
        { status: 400 }
      );
    }

    // 分割成段落
    const paragraphs = splitIntoParagraphs(extractedText);

    if (paragraphs.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "PARSE_FAILED",
            message: "无法提取有效段落，请上传包含清晰英文文字的内容",
          },
        },
        { status: 400 }
      );
    }

    // 创建文章对象
    const articleId = generateId("art");
    const wordCount = paragraphs.reduce((sum, p) => sum + calculateWordCount(p), 0);
    const readingTime = calculateReadingTime(wordCount);

    // 提取标题（从第一段或文件名）
    const title = paragraphs[0].length < 100
      ? paragraphs[0]
      : file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");

    const paragraphObjects = paragraphs.map((content, index) => ({
      id: generateId("p"),
      articleId,
      index,
      content,
      status: "unread" as const,
    }));

    // 推荐段落
    const recommendedParagraphs = paragraphObjects
      .filter((p) => p.content.length > 80 && p.content.length < 400)
      .slice(0, 3)
      .map((p) => p.id);

    logger.info("文件解析成功", {
      articleId,
      title,
      paragraphs: paragraphs.length,
      wordCount,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: articleId,
        title,
        sourceType: "upload",
        url: undefined,
        paragraphs: paragraphObjects,
        wordCount,
        readingTime,
        recommendedParagraphs,
      },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error("文件上传处理失败", { error: errorMsg });

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "文件处理失败，请稍后重试",
          details: errorMsg,
        },
      },
      { status: 500 }
    );
  } finally {
    if (tempFilePath) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch {
        // 忽略清理错误，避免覆盖真实上传/解析异常。
      }
    }
  }
}
