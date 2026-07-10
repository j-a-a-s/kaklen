import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { readApiConfig } from "@kaklen/config";

const REQUEST_ID_HEADER = "x-request-id";

interface RuntimeLogEntry {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  service: string;
  environment: string;
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  organizationId?: string;
  userId?: string;
}

interface RequestWithUser extends Request {
  user?: { sub?: string };
}

export function requestLoggingMiddleware(request: RequestWithUser, response: Response, next: NextFunction): void {
  const startedAt = process.hrtime.bigint();
  const requestId = firstHeaderValue(request.headers[REQUEST_ID_HEADER]) ?? randomUUID();
  response.setHeader("X-Request-Id", requestId);

  response.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const config = readApiConfig(process.env);
    const organizationId = typeof request.params.organizationId === "string" ? request.params.organizationId : undefined;
    const userId = request.user?.sub;
    const entry: RuntimeLogEntry = {
      timestamp: new Date().toISOString(),
      level: response.statusCode >= 500 ? "error" : response.statusCode >= 400 ? "warn" : "info",
      service: "kaklen-api",
      environment: config.nodeEnv,
      requestId,
      method: request.method,
      path: request.originalUrl.split("?")[0] ?? request.originalUrl,
      statusCode: response.statusCode,
      durationMs: Math.round(durationMs),
      ...(organizationId ? { organizationId } : {}),
      ...(userId ? { userId } : {})
    };
    writeLog(entry);
  });

  next();
}

export function redactSecret(value: unknown): unknown {
  if (typeof value === "string") {
    return value;
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const result: Record<string, unknown> = {};
  Object.entries(value).forEach(([key, entry]) => {
    result[key] = isSensitiveKey(key) ? "[REDACTED]" : redactSecret(entry);
  });
  return result;
}

function writeLog(entry: RuntimeLogEntry): void {
  const line = JSON.stringify(entry);
  if (entry.level === "error") {
    process.stderr.write(`${line}\n`);
    return;
  }
  process.stdout.write(`${line}\n`);
}

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function isSensitiveKey(key: string): boolean {
  return ["authorization", "cookie", "set-cookie", "password", "token", "secret", "refreshtoken", "accesstoken"].some((part) =>
    key.toLowerCase().includes(part)
  );
}
