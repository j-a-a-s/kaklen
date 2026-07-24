import { createLoggingMiddleware, redactSecret } from "./runtime-logging";

describe("runtime-logging re-exports from @kokecore/logging", () => {
  it("re-exports redactSecret as redactSensitiveData", () => {
    expect(typeof redactSecret).toBe("function");
  });

  it("redacts secrets recursively", () => {
    expect(
      redactSecret({
        Authorization: "Bearer token",
        nested: {
          password: "secret",
          safe: "value"
        }
      })
    ).toEqual({
      Authorization: "[REDACTED]",
      nested: {
        password: "[REDACTED]",
        safe: "value"
      }
    });
  });

  it("leaves primitive values unchanged while redacting nested tokens", () => {
    expect(redactSecret("plain")).toBe("plain");
    expect(redactSecret(null)).toBeNull();
    expect(redactSecret({ headers: [{ accessToken: "abc" }] })).toEqual({ headers: [{ accessToken: "[REDACTED]" }] });
  });

  it("re-exports createLoggingMiddleware", () => {
    expect(typeof createLoggingMiddleware).toBe("function");
  });
});
