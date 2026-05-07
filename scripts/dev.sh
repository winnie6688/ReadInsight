#!/bin/bash
set -euo pipefail

# 显式声明关键环境变量，不依赖平台执行环境继承
export PORT=5000
export HOSTNAME=0.0.0.0

# 清理 5000 端口残留进程（幂等性：重复执行不会崩溃）
fuser -k 5000/tcp 2>/dev/null || true
sleep 1

echo "Starting Next.js dev server on ${HOSTNAME}:${PORT}..."
cd /workspace/projects
exec pnpm tsx watch src/server.ts
