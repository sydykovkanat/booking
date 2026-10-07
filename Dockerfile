# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
# NEXT_PUBLIC_* are inlined at build time, so they are build args, not runtime env.
ARG NEXT_PUBLIC_ROOM_TIME_ZONE=Asia/Bishkek
ARG NEXT_PUBLIC_DEMO_TOOLS=true
ENV NEXT_PUBLIC_ROOM_TIME_ZONE=$NEXT_PUBLIC_ROOM_TIME_ZONE NEXT_PUBLIC_DEMO_TOOLS=$NEXT_PUBLIC_DEMO_TOOLS
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]
