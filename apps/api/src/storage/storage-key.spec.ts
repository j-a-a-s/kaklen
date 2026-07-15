import { BadRequestException } from "@nestjs/common";
import { assertSafeStorageKey, buildStorageKey, clampExpiration } from "./storage-key";

const organizationId = "11111111-1111-4111-8111-111111111111";
const resourceId = "22222222-2222-4222-8222-222222222222";

describe("storage key validation", () => {
  it("creates organization-scoped keys with sanitized filenames", () => {
    const key = buildStorageKey({
      organizationId,
      resource: "quotations",
      resourceId,
      filename: "../proposal final.pdf",
      contentType: "application/pdf",
      contentLength: 1024
    });

    expect(key).toMatch(
      /^organizations\/11111111-1111-4111-8111-111111111111\/quotations\/22222222-2222-4222-8222-222222222222\/[0-9a-f-]+-proposal-final\.pdf$/
    );
  });

  it("rejects invalid organization scopes and mime types", () => {
    expect(() =>
      buildStorageKey({
        organizationId: "bad",
        resource: "quotations",
        resourceId,
        filename: "file.pdf",
        contentType: "application/pdf",
        contentLength: 1024
      })
    ).toThrow(BadRequestException);

    expect(() =>
      buildStorageKey({
        organizationId,
        resource: "quotations",
        resourceId,
        filename: "file.exe",
        contentType: "application/x-msdownload",
        contentLength: 1024
      })
    ).toThrow(BadRequestException);

    expect(() =>
      buildStorageKey({
        organizationId,
        resource: "Bad Resource",
        resourceId,
        filename: "file.pdf",
        contentType: "application/pdf",
        contentLength: 1024
      })
    ).toThrow(BadRequestException);

    expect(() =>
      buildStorageKey({
        organizationId,
        resource: "quotations",
        resourceId,
        filename: "file.pdf",
        contentType: "application/pdf",
        contentLength: 0
      })
    ).toThrow(BadRequestException);

    expect(() =>
      buildStorageKey({
        organizationId,
        resource: "quotations",
        resourceId,
        filename: "../...",
        contentType: "application/pdf",
        contentLength: 1024
      })
    ).toThrow(BadRequestException);
  });

  it("limits presigned URL expiration", () => {
    expect(clampExpiration(undefined)).toBe(300);
    expect(clampExpiration(60)).toBe(60);
    expect(clampExpiration(900)).toBe(900);
    expect(() => clampExpiration(60.5)).toThrow(BadRequestException);
    expect(() => clampExpiration(3600)).toThrow(BadRequestException);
  });

  it("rejects unsafe storage keys", () => {
    expect(() => assertSafeStorageKey("organizations/org/files/key.pdf")).not.toThrow();
    expect(() => assertSafeStorageKey("other/org/files/key.pdf")).toThrow(BadRequestException);
    expect(() => assertSafeStorageKey("organizations/org/../secret.pdf")).toThrow(BadRequestException);
    expect(() => assertSafeStorageKey("/organizations/org/files/key.pdf")).toThrow(BadRequestException);
  });
});
