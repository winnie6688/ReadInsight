/**
 * 前端日志工具
 * 将日志发送到后端，记录到 /app/work/logs/bypass/console.log
 */

export type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
  url?: string;
  userAgent?: string;
}

// 发送到后端的日志缓冲
let logBuffer: LogEntry[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;
const FLUSH_INTERVAL = 2000; // 2秒后批量发送
const BATCH_SIZE = 10; // 累积10条后立即发送

// 获取基本信息
function getContext() {
  if (typeof window === "undefined") return {};
  return {
    url: window.location.href,
    userAgent: navigator.userAgent,
  };
}

// 添加日志到缓冲
function addLog(level: LogLevel, message: string, data?: unknown) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    data,
    ...getContext(),
  };

  logBuffer.push(entry);

  // 同时打印到控制台
  const consoleMsg = `[${entry.timestamp}] [${level.toUpperCase()}] ${message}`;
  if (data) {
    if (level === "error") {
      console.error(consoleMsg, data);
    } else if (level === "warn") {
      console.warn(consoleMsg, data);
    } else {
      console.log(consoleMsg, data);
    }
  } else {
    if (level === "error") {
      console.error(consoleMsg);
    } else if (level === "warn") {
      console.warn(consoleMsg);
    } else {
      console.log(consoleMsg);
    }
  }

  // 检查是否需要立即发送
  if (logBuffer.length >= BATCH_SIZE) {
    flushLogs();
  } else if (!flushTimeout) {
    flushTimeout = setTimeout(flushLogs, FLUSH_INTERVAL);
  }
}

// 发送到后端
async function flushLogs() {
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }

  if (logBuffer.length === 0) return;

  const logsToSend = [...logBuffer];
  logBuffer = [];

  try {
    const response = await fetch("/api/logs/client", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logs: logsToSend }),
    });

    if (!response.ok) {
      logBuffer = [...logsToSend, ...logBuffer].slice(-BATCH_SIZE);
    }
  } catch {
    logBuffer = [...logsToSend, ...logBuffer].slice(-BATCH_SIZE);
  }
}

// 前端日志 API
export const clientLogger = {
  info: (message: string, data?: unknown) => addLog("info", message, data),
  warn: (message: string, data?: unknown) => addLog("warn", message, data),
  error: (message: string, data?: unknown) => addLog("error", message, data),
  debug: (message: string, data?: unknown) => addLog("debug", message, data),

  // API 调用日志
  api: {
    request: (method: string, url: string, body?: unknown) => {
      clientLogger.info(`[API] ${method} ${url}`, { hasBody: Boolean(body) });
    },
    response: (method: string, url: string, status: number, duration: number, ok: boolean) => {
      if (ok) {
        clientLogger.info(`[API] ${method} ${url} ${status} (${duration}ms)`);
      } else {
        clientLogger.error(`[API] ${method} ${url} ${status} (${duration}ms)`);
      }
    },
    error: (method: string, url: string, error: unknown) => {
      clientLogger.error(`[API] Error: ${method} ${url}`, { error: String(error) });
    },
  },

  // 页面事件日志
  page: {
    view: (pageName: string) => {
      clientLogger.info(`[Page] View: ${pageName}`);
    },
    action: (action: string, data?: unknown) => {
      clientLogger.info(`[Action] ${action}`, data);
    },
    error: (pageName: string, error: unknown, context?: unknown) => {
      clientLogger.error(`[Page Error] ${pageName}`, { error: String(error), context });
    },
  },

  // 用户交互日志
  user: {
    click: (element: string, data?: unknown) => {
      clientLogger.info(`[Click] ${element}`, data);
    },
    input: (field: string, length: number) => {
      clientLogger.debug(`[Input] ${field} (${length} chars)`);
    },
    submit: (form: string) => {
      clientLogger.info(`[Submit] ${form}`);
    },
  },

  // LLM 交互日志
  llm: {
    request: (action: string, model: string) => {
      clientLogger.info(`[LLM] Request: ${action}`, { model });
    },
    response: (action: string, duration: number, success: boolean) => {
      if (success) {
        clientLogger.info(`[LLM] Response: ${action} (${duration}ms)`);
      } else {
        clientLogger.warn(`[LLM] Response failed: ${action} (${duration}ms)`);
      }
    },
    error: (action: string, error: unknown) => {
      clientLogger.error(`[LLM] Error: ${action}`, { error: String(error) });
    },
    stream: (action: string, status: "start" | "chunk" | "end" | "error", data?: unknown) => {
      clientLogger.debug(`[LLM Stream] ${action} - ${status}`, data);
    },
  },

  // 组件渲染日志
  component: {
    mount: (name: string) => {
      clientLogger.debug(`[Mount] ${name}`);
    },
    unmount: (name: string) => {
      clientLogger.debug(`[Unmount] ${name}`);
    },
    error: (name: string, error: unknown) => {
      clientLogger.error(`[Component Error] ${name}`, { error: String(error) });
    },
  },

  // 刷新待发送日志
  flush: () => flushLogs(),
};

// 页面加载时发送已缓冲的日志
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    flushLogs();
  });
}

export default clientLogger;
