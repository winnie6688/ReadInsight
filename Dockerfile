FROM node:22.13-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

RUN npm install -g pnpm@11.0.6

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

RUN pnpm install --frozen-lockfile

FROM deps AS builder

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm next build
RUN pnpm tsup src/server.ts --format cjs --platform node --target node22 --outDir dist --no-splitting --no-minify
RUN pnpm prune --prod

FROM base AS runner

ENV NODE_ENV=production
ENV COZE_PROJECT_ENV=PROD
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "dist/server.js"]
