import { createPublicToken, hashPublicToken } from "./public-token";

describe("public quotation token", () => {
  it("creates URL-safe high-entropy tokens and stores only deterministic hashes", () => {
    const first = createPublicToken();
    const second = createPublicToken();

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).not.toBe(first);
    expect(hashPublicToken(first)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashPublicToken(first)).toBe(hashPublicToken(first));
    expect(hashPublicToken(first)).not.toContain(first);
  });
});
