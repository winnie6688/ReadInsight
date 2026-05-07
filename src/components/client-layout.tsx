"use client";

import { ReactNode, useEffect } from "react";
import { ErrorBoundary as GlobalErrorBoundary } from "@/components/error-boundary";
import { clientLogger } from "@/lib/client-logger";
import { Toaster } from "sonner";

interface ClientLayoutProps {
  children: ReactNode;
}

export function ClientLayout({ children }: ClientLayoutProps) {
  // 全局未捕获错误处理
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      clientLogger.error("Uncaught error", {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      clientLogger.error("Unhandled promise rejection", {
        reason: String(event.reason),
      });
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    clientLogger.info("Client layout mounted");

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      clientLogger.flush();
    };
  }, []);

  return (
    <GlobalErrorBoundary>
      <Toaster position="top-center" richColors />
      {children}
    </GlobalErrorBoundary>
  );
}
