export interface CreateUploadUrlInput {
  organizationId: string;
  resource: string;
  resourceId: string;
  filename: string;
  contentType: string;
  contentLength: number;
  expiresInSeconds?: number;
}

export interface CreateUploadUrlResult {
  key: string;
  uploadUrl: string;
  expiresInSeconds: number;
}

export interface CreateDownloadUrlInput {
  key: string;
  expiresInSeconds?: number;
}

export interface StorageService {
  createUploadUrl(input: CreateUploadUrlInput): Promise<CreateUploadUrlResult>;
  createDownloadUrl(input: CreateDownloadUrlInput): Promise<string>;
  deleteObject(key: string): Promise<void>;
  objectExists(key: string): Promise<boolean>;
}

export const STORAGE_SERVICE = Symbol("STORAGE_SERVICE");
