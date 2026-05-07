"use client";

import { useAppStore } from "@/lib/store";

export function LoadingOverlay() {
  const { isLoading, loadingMessage } = useAppStore();

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-8 shadow-2xl text-center max-w-sm mx-4">
        <div className="w-16 h-16 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[var(--foreground)] font-medium">
          {loadingMessage || "加载中..."}
        </p>
        <p className="text-sm text-[var(--muted-foreground)] mt-2">
          请稍候
        </p>
      </div>
    </div>
  );
}
