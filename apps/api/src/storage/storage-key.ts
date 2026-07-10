import { randomUUID } from "node:crypto";
import { BadRequestException } from "@nestjs/common";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "text/plain"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function buildStorageKey(input: {
  organizationId: string;
  resource: string;
  resourceId: string;
  filename: string;
  contentType: string;
  contentLength: number;
}): string {
  if (!UUID_PATTERN.test(input.organizationId) || !UUID_PATTERN.test(input.resourceId)) {
    throw new BadRequestException("Invalid storage scope");
  }
  if (!/^[a-z][a-z0-9-]{1,40}$/.test(input.resource)) {
    throw new BadRequestException("Invalid storage resource");
  }
  if (input.contentLength <= 0 || input.contentLength > MAX_FILE_SIZE_BYTES) {
    throw new BadRequestException("Invalid file size");
  }
  if (!ALLOWED_MIME_TYPES.has(input.contentType)) {
    throw new BadRequestException("Invalid file type");
  }
  const filename = sanitizeFilename(input.filename);
  return `organizations/${input.organizationId}/${input.resource}/${input.resourceId}/${randomUUID()}-${filename}`;
}

export function assertSafeStorageKey(key: string): void {
  if (!key.startsWith("organizations/") || key.includes("..") || key.includes("\\") || key.startsWith("/")) {
    throw new BadRequestException("Invalid storage key");
  }
}

export function clampExpiration(value: number | undefined): number {
  const expiresInSeconds = value ?? 300;
  if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 60 || expiresInSeconds > 900) {
    throw new BadRequestException("Storage URL expiration must be between 60 and 900 seconds");
  }
  return expiresInSeconds;
}

function sanitizeFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop()?.trim() ?? "";
  const sanitized = base
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 120);
  if (!sanitized || sanitized === "." || sanitized === "..") {
    throw new BadRequestException("Invalid filename");
  }
  return sanitized;
}
