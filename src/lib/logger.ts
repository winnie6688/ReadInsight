/**
 * 后端日志工具
 * 所有日志统一写入 /app/work/logs/bypass/ 目录
 */

import fs from "fs";
import path from "path";

const PRIMARY_LOG_DIR = "/app/work/logs/bypass";
const FALLBACK_LOG_DIR = path.join(process.cwd(), ".coze-logs");

function resolveLogDir() {
  try {
    fs.mkdirSync(PRIMARY_LOG_DIR, { recursive: true });
    return PRIMARY_LOG_DIR;
  } catch {
    fs.mkdirSync(FALLBACK_LOG_DIR, { recursive: true });
    return FALLBACK_LOG_DIR;
  }
}

// 确保日志目录存在
function ensureLogDir() {
  return resolveLogDir();
}

// 写入日志文件
function writeLog(filePath: string, level: string, message: string, meta?: Record<string, unknown>) {
  const logDir = ensureLogDir();
  const resolvedFilePath = path.join(logDir, path.basename(filePath));
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` | ${JSON.stringify(meta)}` : "";
  const logLine = `[${timestamp}] [${level}] ${message}${metaStr}\n`;

  fs.appendFileSync(resolvedFilePath, logLine, "utf-8");
}

// 通用日志函数
function log(level: "INFO" | "WARN" | "ERROR" | "DEBUG", message: string, meta?: Record<string, unknown>) {
  // 始终写入 app.log
  writeLog(path.join(PRIMARY_LOG_DIR, "app.log"), level, message, meta);

  // DEBUG 只写入 dev.log
  if (level === "DEBUG") {
    writeLog(path.join(PRIMARY_LOG_DIR, "dev.log"), level, message, meta);
  } else {
    // INFO/WARN/ERROR 同时写入 dev.log
    writeLog(path.join(PRIMARY_LOG_DIR, "dev.log"), level, message, meta);
  }
}

export type FrontendLogEntry = {
  timestamp?: string;
  level?: string;
  message?: string;
  data?: unknown;
  url?: string;
  userAgent?: string;
};

function sanitizeText(value: string, maxLength: number) {
  const normalized = value.replace(/[\r\n]+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}...`;
}

function safeJsonStringify(value: unknown, maxLength: number) {
  try {
    const text = JSON.stringify(value);
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength)}...`;
  } catch {
    return JSON.stringify("[unserializable]");
  }
}

function formatFrontendLogLine(entry: FrontendLogEntry) {
  const timestamp = sanitizeText(entry.timestamp || new Date().toISOString(), 64);
  const level = sanitizeText((entry.level || "info").toUpperCase(), 16);
  const message = sanitizeText(entry.message || "", 2000);
  const meta = {
    data: entry.data,
    url: entry.url,
    userAgent: entry.userAgent,
  };
  const metaStr = safeJsonStringify(meta, 8000);
  return `[${timestamp}] [${level}] ${message} | ${metaStr}\n`;
}

function writeFrontendLogs(entries: FrontendLogEntry[]) {
  if (!entries.length) return { written: 0, dropped: 0 };

  const validEntries = entries.filter((e) => typeof e?.message === "string" && e.message.trim().length > 0);
  const lines = validEntries.map(formatFrontendLogLine).join("");

  const logDir = ensureLogDir();
  const filePath = path.join(logDir, "console.log");
  fs.appendFileSync(filePath, lines, "utf-8");

  return { written: validEntries.length, dropped: entries.length - validEntries.length };
}

// 日志导出
export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => log("INFO", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log("WARN", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log("ERROR", message, meta),
  debug: (message: string, meta?: Record<string, unknown>) => log("DEBUG", message, meta),

  client: {
    ingest: (entries: FrontendLogEntry[]) => writeFrontendLogs(entries),
  },

  // API 请求日志
  api: {
    request: (method: string, path: string, body?: unknown) => {
      logger.info(`API Request: ${method} ${path}`, { body });
    },
    response: (method: string, path: string, status: number, duration: number) => {
      logger.info(`API Response: ${method} ${path} ${status} (${duration}ms)`);
    },
    error: (method: string, path: string, error: unknown) => {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`API Error: ${method} ${path}`, { error: errorMsg });
    },
  },

  // LLM 调用日志
  llm: {
    request: (model: string, messageCount: number) => {
      logger.info(`LLM Request`, { model, messageCount });
    },
    response: (model: string, duration: number, success: boolean) => {
      logger.info(`LLM Response`, { model, duration, success });
    },
    error: (model: string, error: unknown) => {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`LLM Error`, { model, error: errorMsg });
    },
    timeout: (model: string, timeoutMs: number) => {
      logger.warn(`LLM Timeout`, { model, timeoutMs });
    },
  },

  // 用户操作日志
  user: {
    parseArticle: (source: "url" | "paste", success: boolean) => {
      logger.info(`User: Parse Article`, { source, success });
    },
    submitTranslation: (paragraphId: string, success: boolean) => {
      logger.info(`User: Submit Translation`, { paragraphId, success });
    },
    diagnoseTranslation: (paragraphId: string, success: boolean, duration: number) => {
      logger.info(`User: Diagnose Translation`, { paragraphId, success, duration });
    },
    generatePractice: (articleId: string, success: boolean) => {
      logger.info(`User: Generate Practice`, { articleId, success });
    },
  },
};

export default logger;
