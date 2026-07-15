import { EventEmitter } from "node:events";
import { requestLoggingMiddleware, redactSecret } from "./runtime-logging";

describe("runtime logging", () => {
  const stdoutWrite = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  const stderrWrite = jest.spyOn(process.stderr, "write").mockImplementation(() => true);

  afterEach(() => {
    stdoutWrite.mockClear();
    stderrWrite.mockClear();
  });

  afterAll(() => {
    stdoutWrite.mockRestore();
    stderrWrite.mockRestore();
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

  it("logs successful requests with existing request id and organization/user context", () => {
    const response = makeResponse(200);
    const next = jest.fn();

    requestLoggingMiddleware(
      {
        headers: { "x-request-id": ["req-1"] },
        params: { organizationId: "org-1" },
        user: { sub: "user-1" },
        method: "GET",
        originalUrl: "/api/organizations/org-1?expand=true"
      } as never,
      response as never,
      next
    );
    response.emit("finish");

    expect(response.setHeader).toHaveBeenCalledWith("X-Request-Id", "req-1");
    expect(next).toHaveBeenCalled();
    expect(JSON.parse(String(stdoutWrite.mock.calls[0]?.[0]))).toMatchObject({
      level: "info",
      requestId: "req-1",
      path: "/api/organizations/org-1",
      organizationId: "org-1",
      userId: "user-1"
    });
  });

  it("generates request ids and sends warnings/errors to the expected streams", () => {
    const warnResponse = makeResponse(404);
    const errorResponse = makeResponse(500);

    requestLoggingMiddleware(
      { headers: {}, params: {}, method: "POST", originalUrl: "/api/auth/login" } as never,
      warnResponse as never,
      jest.fn()
    );
    warnResponse.emit("finish");
    requestLoggingMiddleware(
      { headers: {}, params: {}, method: "POST", originalUrl: "/api/fail" } as never,
      errorResponse as never,
      jest.fn()
    );
    errorResponse.emit("finish");

    expect(JSON.parse(String(stdoutWrite.mock.calls[0]?.[0])).level).toBe("warn");
    expect(JSON.parse(String(stderrWrite.mock.calls[0]?.[0])).level).toBe("error");
    expect(warnResponse.setHeader.mock.calls[0]?.[1]).toEqual(expect.any(String));
  });
});

function makeResponse(statusCode: number) {
  const emitter = new EventEmitter() as EventEmitter & { statusCode: number; setHeader: jest.Mock };
  emitter.statusCode = statusCode;
  emitter.setHeader = jest.fn();
  return emitter;
}
