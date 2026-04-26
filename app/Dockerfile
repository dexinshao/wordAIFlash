FROM node:20-alpine AS base
RUN apk add --no-cache python3 make g++

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 编译数据库 seed 脚本为 JS（用于 pre-deploy）
RUN npx esbuild db/seed-fast.ts --platform=node --bundle --format=esm --outdir=dist/db --banner:js="import { createRequire } from 'module';const require = createRequire(import.meta.url);"

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/db ./db

# Railway 注入的端口
ENV PORT=3000
EXPOSE 3000

CMD ["node", "dist/boot.js"]
