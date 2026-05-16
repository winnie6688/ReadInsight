import { NextRequest, NextResponse } from "next/server";
import { logger, type FrontendLogEntry } from "@/lib/logger";

export const runtime = "nodejs";

const MAX_LOGS_PER_REQUEST = 200;

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: "INVALID_JSON", message: "请求体必须是 JSON" },
      },
      { status: 400 }
    );
  }

  const logs = (body as { logs?: unknown })?.logs;
  if (!Array.isArray(logs)) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "INVALID_PARAMS", message: "logs 必须是数组" },
      },
      { status: 400 }
    );
  }

  const received = logs.length;
  const limitedLogs = logs.slice(0, MAX_LOGS_PER_REQUEST) as FrontendLogEntry[];
  const droppedByLimit = received - limitedLogs.length;

  try {
    const { written, dropped } = logger.client.ingest(limitedLogs);
    const duration = Date.now() - startTime;

    logger.api.response("POST", "/api/logs/client", 200, duration);

    return NextResponse.json({
      success: true,
      data: {
        received,
        written,
        dropped: dropped + droppedByLimit,
        duration,
      },
    });
  } catch (error) {
    logger.api.error("POST", "/api/logs/client", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "日志写入失败" },
      },
      { status: 500 }
    );
  }
}

