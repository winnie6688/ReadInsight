import { NextRequest, NextResponse } from "next/server";
import { performFullDiagnosis } from "@/lib/llm";
import { logger } from "@/lib/logger";
import type { DiagnoseRequest, DiagnoseResponse, ApiResponse } from "@/types";

// POST /api/diagnose
export async function POST(request: NextRequest) {
  try {
    const body: DiagnoseRequest = await request.json();

    const { articleId, paragraphId, originalParagraph, userTranslation } = body;

    if (!originalParagraph || !userTranslation) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: {
            code: "INVALID_PARAMS",
            message: "请提供原文和翻译",
          },
        },
        { status: 400 }
      );
    }

    if (userTranslation.trim().length < 5) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: {
            code: "INVALID_PARAMS",
            message: "翻译内容太短，请输入更完整的翻译",
          },
        },
        { status: 400 }
      );
    }

    // 执行完整诊断
    const result = await performFullDiagnosis(
      originalParagraph,
      userTranslation,
      paragraphId,
      articleId,
      "" // 文章标题会在前端传入
    );

    const response: DiagnoseResponse = {
      ...result,
      paragraphId,
    };

    return NextResponse.json<ApiResponse<DiagnoseResponse>>({
      success: true,
      data: response,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const isTimeout = errorMsg.includes("timeout") || errorMsg.includes("aborted");
    
    logger.error(`[${new Date().toISOString()}] Diagnose error`, {
      error: errorMsg,
      isTimeout,
      type: error instanceof Error ? error.constructor.name : "Unknown"
    });

    if (isTimeout) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: {
            code: "LLM_TIMEOUT",
            message: "AI 分析超时，请稍后重试（建议稍后重试）",
            details: "LLM 响应超过 180 秒",
          },
        },
        { status: 504 }
      );
    }

    if (error instanceof Error && error.message.includes("LLM API")) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: {
            code: "LLM_ERROR",
            message: "AI 服务暂时不可用，请稍后重试",
            details: errorMsg,
          },
        },
        { status: 503 }
      );
    }

    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "诊断分析失败，请稍后重试",
          details: errorMsg,
        },
      },
      { status: 500 }
    );
  }
}
