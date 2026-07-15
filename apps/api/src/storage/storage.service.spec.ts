import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { BadRequestException } from "@nestjs/common";
import { LocalStorageService } from "./local-storage.service";
import { S3StorageService } from "./s3-storage.service";

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn(async () => "https://signed.example/object")
}));

const organizationId = "11111111-1111-4111-8111-111111111111";
const resourceId = "22222222-2222-4222-8222-222222222222";

describe("storage services", () => {
  beforeEach(() => {
    process.env.AWS_REGION = "us-east-1";
    process.env.AWS_S3_BUCKET = "kaklen-test";
    jest.clearAllMocks();
  });

  it("creates local upload/download URLs and tracks object existence", async () => {
    const service = new LocalStorageService();
    const upload = await service.createUploadUrl({
      organizationId,
      resource: "quotations",
      resourceId,
      filename: "proposal.pdf",
      contentType: "application/pdf",
      contentLength: 1024,
      expiresInSeconds: 60
    });

    await expect(service.objectExists(upload.key)).resolves.toBe(true);
    await expect(service.createDownloadUrl({ key: upload.key, expiresInSeconds: 120 })).resolves.toContain("download=1");
    await service.deleteObject(upload.key);
    await expect(service.objectExists(upload.key)).resolves.toBe(false);
  });

  it("rejects unsafe local storage keys", async () => {
    const service = new LocalStorageService();

    await expect(service.createDownloadUrl({ key: "../secret", expiresInSeconds: 60 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.deleteObject("../secret")).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.objectExists("../secret")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("creates S3 signed upload and download URLs", async () => {
    const service = new S3StorageService();
    const upload = await service.createUploadUrl({
      organizationId,
      resource: "events",
      resourceId,
      filename: "agenda.pdf",
      contentType: "application/pdf",
      contentLength: 2048,
      expiresInSeconds: 300
    });

    await expect(service.createDownloadUrl({ key: upload.key, expiresInSeconds: 300 })).resolves.toBe("https://signed.example/object");
    expect(upload.uploadUrl).toBe("https://signed.example/object");
    expect(getSignedUrl).toHaveBeenCalledTimes(2);
  });

  it("deletes and checks S3 objects through the AWS client", async () => {
    const service = new S3StorageService();
    const send = jest.fn(async () => ({}));
    Object.defineProperty(service, "client", { value: { send }, configurable: true });

    await service.deleteObject(`organizations/${organizationId}/events/${resourceId}/file.pdf`);
    await expect(service.objectExists(`organizations/${organizationId}/events/${resourceId}/file.pdf`)).resolves.toBe(true);
    send.mockRejectedValueOnce(new Error("missing"));
    await expect(service.objectExists(`organizations/${organizationId}/events/${resourceId}/missing.pdf`)).resolves.toBe(false);

    expect(send).toHaveBeenCalledTimes(3);
  });
});
