/**
 * API 调用封装（带日志记录）
 */

import { clientLogger } from "./client-logger";

interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  timeout?: number;
}

interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: string;
  };
}

async function apiCall<T>(url: string, options: ApiOptions = {}): Promise<ApiResult<T>> {
  const { method = "POST", body, timeout = 180000 } = options;
  const startTime = Date.now();

  clientLogger.api.request(method, url, body);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const duration = Date.now() - startTime;
    const result = await response.json() as ApiResult<T>;

    clientLogger.api.response(method, url, response.status, duration, response.ok);

    return result;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === "AbortError") {
      clientLogger.api.error(method, url, "Request timeout");
      return {
        success: false,
        error: {
          code: "TIMEOUT",
          message: "请求超时，请稍后重试",
          details: `Timeout after ${timeout}ms`,
        },
      };
    }

    clientLogger.api.error(method, url, error);

    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: "网络请求失败，请检查网络连接",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

// API 函数封装
export const api = {
  // 文章解析
  parseArticle: (params: { type: "url" | "paste"; url?: string; content?: string; title?: string }) =>
    apiCall("/api/article/parse", { body: params }),

  // 翻译诊断
  diagnose: (params: { articleId: string; paragraphId: string; originalParagraph: string; userTranslation: string }) =>
    apiCall("/api/diagnose", { body: params, timeout: 200000 }),

  // 生成练习题
  generatePractice: (params: { knowledgePoints: unknown[]; count?: number; articleContext?: string }) =>
    apiCall("/api/practice/generate", { body: params, timeout: 200000 }),
};

export default api;
