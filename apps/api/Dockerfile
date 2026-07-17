# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS build-base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

FROM build-base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY apps apps
COPY packages packages
COPY prisma prisma
COPY scripts scripts
RUN pnpm prisma:generate
RUN pnpm build
RUN CI=true pnpm prune --prod

FROM node:22-bookworm-slim AS runtime-base
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl tini \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system kaklen \
  && useradd --system --gid kaklen --home /app --shell /usr/sbin/nologin kaklen

COPY --from=builder --chown=kaklen:kaklen /app/node_modules ./node_modules
COPY --from=builder --chown=kaklen:kaklen /app/package.json ./package.json
COPY --from=builder --chown=kaklen:kaklen /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder --chown=kaklen:kaklen /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder --chown=kaklen:kaklen /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=kaklen:kaklen /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=kaklen:kaklen /app/packages/config/package.json ./packages/config/package.json
COPY --from=builder --chown=kaklen:kaklen /app/packages/config/dist ./packages/config/dist
COPY --from=builder --chown=kaklen:kaklen /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder --chown=kaklen:kaklen /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=kaklen:kaklen /app/packages/shared/runtime ./packages/shared/runtime
COPY --from=builder --chown=kaklen:kaklen /app/prisma ./prisma

USER kaklen
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD curl -fsS http://127.0.0.1:${PORT}/api/health/live || exit 1
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "apps/api/dist/main.js"]

FROM runtime-base AS migration-runner
CMD ["node_modules/.bin/prisma", "migrate", "deploy", "--schema", "prisma/schema.prisma"]
