import { Injectable } from "@nestjs/common";
import { assertSafeStorageKey, buildStorageKey, clampExpiration } from "./storage-key";
import { CreateDownloadUrlInput, CreateUploadUrlInput, CreateUploadUrlResult, StorageService } from "./storage.types";

@Injectable()
export class LocalStorageService implements StorageService {
  private readonly objects = new Set<string>();

  async createUploadUrl(input: CreateUploadUrlInput): Promise<CreateUploadUrlResult> {
    const expiresInSeconds = clampExpiration(input.expiresInSeconds);
    const key = buildStorageKey(input);
    this.objects.add(key);
    return {
      key,
      uploadUrl: `http://localhost:3000/local-storage/${encodeURIComponent(key)}?expires=${expiresInSeconds}`,
      expiresInSeconds
    };
  }

  async createDownloadUrl(input: CreateDownloadUrlInput): Promise<string> {
    const expiresInSeconds = clampExpiration(input.expiresInSeconds);
    assertSafeStorageKey(input.key);
    return `http://localhost:3000/local-storage/${encodeURIComponent(input.key)}?download=1&expires=${expiresInSeconds}`;
  }

  async deleteObject(key: string): Promise<void> {
    assertSafeStorageKey(key);
    this.objects.delete(key);
  }

  async objectExists(key: string): Promise<boolean> {
    assertSafeStorageKey(key);
    return this.objects.has(key);
  }
}
