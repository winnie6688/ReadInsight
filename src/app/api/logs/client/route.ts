import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

type ClientLogLevel = "info" | "warn" | "error" | "debug";

interface ClientLogEntry {
  timestamp?: string;
  level?: ClientLogLevel;
  message?: string;
  data?: unknown;
  url?: string;
  userAgent?: string;
}

const PRIMARY_LOG_DIR = "/app/work/logs/bypass";
const FALLBACK_LOG_DIR = path.join(process.cwd(), ".coze-logs");
const MAX_LOGS_PER_BATCH = 50;

function resolveLogDir() {
  try {
    fs.mkdirSync(PRIMARY_LOG_DIR, { recursive: true });
    return PRIMARY_LOG_DIR;
  } catch {
    fs.mkdirSync(FALLBACK_LOG_DIR, { recursive: true });
    return FALLBACK_LOG_DIR;
  }
}

function normalizeLog(entry: ClientLogEntry) {
  return {
    timestamp: entry.timestamp || new Date().toISOString(),
    level: entry.level || "info",
    message: String(entry.message || ""),
    data: entry.data,
    url: entry.url,
    userAgent: entry.userAgent,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { logs?: ClientLogEntry[] };

    if (!Array.isArray(body.logs)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_PARAMS",
            message: "logs 必须是数组",
          },
        },
        { status: 400 }
      );
    }

    const logs = body.logs.slice(0, MAX_LOGS_PER_BATCH).map(normalizeLog);
    const logDir = resolveLogDir();
    const filePath = path.join(logDir, "console.log");
    const content = logs.map((log) => JSON.stringify(log)).join("\n");

    if (content) {
      fs.appendFileSync(filePath, `${content}\n`, "utf-8");
    }

    return NextResponse.json({
      success: true,
      data: {
        count: logs.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "前端日志写入失败",
          details: error instanceof Error ? error.message : String(error),
        },
      },
      { status: 500 }
    );
  }
}
