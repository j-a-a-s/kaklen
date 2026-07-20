import { BadRequestException } from "@nestjs/common";
import {
  assertSafeStorageKey as assertKokecoreSafeStorageKey,
  buildStorageKey as buildKokecoreStorageKey,
  clampExpiration as clampKokecoreExpiration,
  type CreateUploadUrlInput,
  StorageProvider,
  type StorageConfig
} from "@kokecore/storage";

const STORAGE_CONFIG: StorageConfig = {
  provider: StorageProvider.S3,
  maxFileSizeBytes: 20 * 1024 * 1024,
  allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png", "text/plain"]
};

export function buildStorageKey(input: CreateUploadUrlInput): string {
  try {
    return buildKokecoreStorageKey(input, STORAGE_CONFIG);
  } catch {
    throw new BadRequestException("Invalid storage upload input");
  }
}

export function assertSafeStorageKey(key: string): void {
  try {
    assertKokecoreSafeStorageKey(key);
  } catch {
    throw new BadRequestException("Invalid storage key");
  }
}

export function clampExpiration(value: number | undefined): number {
  const expiresInSeconds = value ?? 300;
  if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 60 || expiresInSeconds > 900) {
    throw new BadRequestException("Storage URL expiration must be between 60 and 900 seconds");
  }
  return clampKokecoreExpiration(expiresInSeconds);
}
