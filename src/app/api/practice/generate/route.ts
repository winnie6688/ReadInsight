import { NextRequest, NextResponse } from "next/server";
import { generatePracticeQuestions } from "@/lib/llm";
import { logger } from "@/lib/logger";
import type { GeneratePracticeRequest, GeneratePracticeResponse, ApiResponse } from "@/types";

// POST /api/practice/generate
export async function POST(request: NextRequest) {
  try {
    const body: GeneratePracticeRequest = await request.json();

    const { knowledgePoints, count = 5 } = body;

    if (!knowledgePoints || knowledgePoints.length === 0) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: {
            code: "INVALID_PARAMS",
            message: "请提供知识点列表",
          },
        },
        { status: 400 }
      );
    }

    // 转换知识点格式
    const points = knowledgePoints.map((kp) => ({
      content: kp.content,
      meaning: kp.meaning,
      type: kp.type,
    }));

    // 生成练习题
    const result = await generatePracticeQuestions(points, count);

    const response: GeneratePracticeResponse = {
      questions: result.questions,
      totalCount: result.totalCount,
      estimatedTime: result.estimatedTime,
    };

    return NextResponse.json<ApiResponse<GeneratePracticeResponse>>({
      success: true,
      data: response,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`[${new Date().toISOString()}] Practice generate error`, {
      error: errorMsg,
      type: error instanceof Error ? error.constructor.name : "Unknown"
    });
    console.error("Practice generate error:", error);

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
          message: "练习题生成失败，请稍后重试",
          details: errorMsg,
        },
      },
      { status: 500 }
    );
  }
}
