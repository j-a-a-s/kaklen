import { Injectable } from "@nestjs/common";
import { readApiConfig } from "@kaklen/config";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { assertSafeStorageKey, buildStorageKey, clampExpiration } from "./storage-key";
import { CreateDownloadUrlInput, CreateUploadUrlInput, CreateUploadUrlResult, StorageService } from "./storage.types";

@Injectable()
export class S3StorageService implements StorageService {
  private readonly config = readApiConfig(process.env);
  private readonly client = new S3Client({
    region: this.config.awsRegion,
    ...(this.config.awsS3Endpoint ? { endpoint: this.config.awsS3Endpoint, forcePathStyle: true } : {})
  });

  async createUploadUrl(input: CreateUploadUrlInput): Promise<CreateUploadUrlResult> {
    const expiresInSeconds = clampExpiration(input.expiresInSeconds);
    const key = buildStorageKey(input);
    const uploadUrl = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.config.awsS3Bucket,
        Key: key,
        ContentType: input.contentType,
        ContentLength: input.contentLength
      }),
      { expiresIn: expiresInSeconds }
    );
    return { key, uploadUrl, expiresInSeconds };
  }

  async createDownloadUrl(input: CreateDownloadUrlInput): Promise<string> {
    const expiresInSeconds = clampExpiration(input.expiresInSeconds);
    assertSafeStorageKey(input.key);
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.config.awsS3Bucket, Key: input.key }),
      { expiresIn: expiresInSeconds }
    );
  }

  async deleteObject(key: string): Promise<void> {
    assertSafeStorageKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.awsS3Bucket, Key: key }));
  }

  async objectExists(key: string): Promise<boolean> {
    assertSafeStorageKey(key);
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.config.awsS3Bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }
}
