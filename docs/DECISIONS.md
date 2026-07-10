# Architecture Decisions

## 0001. Use pnpm Workspaces with Turborepo

Status: Accepted

Kaklen uses pnpm workspaces for dependency management and Turborepo for task orchestration. This keeps application and package boundaries explicit while allowing shared scripts for build, lint, and test.

## 0002. Keep Shared Contracts in Packages

Status: Accepted

Contracts that cross application boundaries live in `packages/shared`. Runtime configuration helpers live in `packages/config`. This prevents app-to-app imports and keeps dependencies directional.

## 0003. Use Prisma with PostgreSQL 16

Status: Accepted

Prisma is the database access layer and PostgreSQL 16 is the local development database. Docker Compose provides the local database service and Prisma migrations define schema history.

## 0004. Swagger and Helmet Are Part of the API Foundation

Status: Accepted

Swagger is enabled at `/docs` so API behavior is inspectable early. Helmet is enabled by default so the API starts from a hardened HTTP baseline.
