# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY vendor/kokecore/packages/auth/package.json vendor/kokecore/packages/auth/package.json
COPY vendor/kokecore/packages/calendar/package.json vendor/kokecore/packages/calendar/package.json
COPY vendor/kokecore/packages/config/package.json vendor/kokecore/packages/config/package.json
COPY vendor/kokecore/packages/errors/package.json vendor/kokecore/packages/errors/package.json
COPY vendor/kokecore/packages/logging/package.json vendor/kokecore/packages/logging/package.json
COPY vendor/kokecore/packages/rbac/package.json vendor/kokecore/packages/rbac/package.json
COPY vendor/kokecore/packages/storage/package.json vendor/kokecore/packages/storage/package.json
COPY vendor/kokecore/packages/validation/package.json vendor/kokecore/packages/validation/package.json
RUN --mount=type=cache,id=kaklen-pnpm-store,target=/pnpm/store,sharing=locked \
  pnpm install --store-dir=/pnpm/store --frozen-lockfile --filter @kaklen/web...

FROM deps AS builder
ARG APP_VERSION=0.1.0
ARG BUILD_TIME=1970-01-01T00:00:00.000Z
ARG COMMIT_SHA=container
ARG PUBLIC_API_BASE_URL=http://localhost:3000/api
ARG PUBLIC_APP_ENVIRONMENT=production
ENV APP_VERSION="$APP_VERSION"
ENV BUILD_TIME="$BUILD_TIME"
ENV COMMIT_SHA="$COMMIT_SHA"
ENV PUBLIC_API_BASE_URL="$PUBLIC_API_BASE_URL"
ENV PUBLIC_APP_ENVIRONMENT="$PUBLIC_APP_ENVIRONMENT"
COPY apps/web apps/web
COPY packages/shared packages/shared
COPY scripts scripts
COPY vendor/kokecore/packages/validation vendor/kokecore/packages/validation
COPY vendor/kokecore/tsconfig.base.json vendor/kokecore/tsconfig.base.json
RUN pnpm --filter @kokecore/validation build
RUN pnpm --filter @kaklen/shared build
RUN pnpm --filter @kaklen/web build:es \
  && pnpm --filter @kaklen/web build:en \
  && pnpm --filter @kaklen/web build:pt-BR
RUN test -f apps/web/dist/web/es/browser/index.html \
  && test -f apps/web/dist/web/en/browser/index.html \
  && test -f apps/web/dist/web/pt-BR/browser/index.html

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV WEB_PORT=8080
ENV WEB_DIST_ROOT=/app/apps/web/dist/web
WORKDIR /app
COPY --from=builder --chown=node:node /app/apps/web/dist/web ./apps/web/dist/web
COPY --from=builder --chown=node:node /app/apps/web/public/runtime-config.js ./apps/web/public/runtime-config.js
COPY --from=builder --chown=node:node /app/apps/web/public/runtime-config.json ./apps/web/public/runtime-config.json
COPY --from=builder --chown=node:node /app/scripts/i18n-server.mjs ./scripts/i18n-server.mjs
COPY --from=builder --chown=node:node /app/scripts/serve-i18n.mjs ./scripts/serve-i18n.mjs
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:8080/es/login').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"]
CMD ["node", "scripts/serve-i18n.mjs"]
