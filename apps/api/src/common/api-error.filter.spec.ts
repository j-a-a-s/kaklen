import { BadRequestException, ArgumentsHost, ConflictException, HttpException, InternalServerErrorException } from "@nestjs/common";
import { ApiErrorFilter } from "./api-error.filter";
import { RateLimitExceededException } from "./rate-limit-exceptions";
import { SafeOperationalLogger, type OperationalLogSink } from "./safe-operational-logger";

interface TestBody {
  code: string;
  message: string;
  statusCode: number;
  field?: string;
  resourceId?: string;
  repairable?: boolean;
}

interface TestResponse {
  statusCode?: number;
  body?: TestBody;
  status(statusCode: number): TestResponse;
  json(body: TestBody): TestResponse;
  setHeader(name: string, value: string): void;
  headers?: Record<string, string>;
}

describe("ApiErrorFilter", () => {
  it("keeps a stable error code regardless of locale-like headers", () => {
    const filter = new ApiErrorFilter();
    const esResponse = createResponse();
    const enResponse = createResponse();

    filter.catch(new BadRequestException("Dato invalido"), createHost(esResponse, "es"));
    filter.catch(new BadRequestException("Invalid data"), createHost(enResponse, "en"));

    expect(esResponse.body?.code).toBe("BAD_REQUEST");
    expect(enResponse.body?.code).toBe("BAD_REQUEST");
    expect(esResponse.body?.statusCode).toBe(400);
    expect(enResponse.body?.statusCode).toBe(400);
  });

  it("preserves typed backend error codes and first validation message", () => {
    const filter = new ApiErrorFilter();
    const response = createResponse();

    filter.catch(
      new BadRequestException({
        code: "RUT_INVALID",
        message: ["RUT_INVALID", "ignored"],
        statusCode: 400
      }),
      createHost(response, "es")
    );

    expect(response.body).toEqual({
      code: "RUT_INVALID",
      message: "RUT_INVALID",
      statusCode: 400
    });
  });

  it("uses default request failure message for empty HTTP exception bodies", () => {
    const filter = new ApiErrorFilter();
    const response = createResponse();

    filter.catch(new HttpException({}, 418), createHost(response, "en"));

    expect(response.body).toEqual({
      code: "INTERNAL_SERVER_ERROR",
      message: "Request failed",
      statusCode: 418
    });
  });

  it("preserves a structured field without exposing arbitrary exception details", () => {
    const filter = new ApiErrorFilter();
    const response = createResponse();

    filter.catch(new ConflictException({
      code: "QUOTATION_MONEY_MISMATCH",
      message: "Quotation totals are inconsistent.",
      field: "items.0.total",
      resourceId: "quotation-1",
      repairable: true,
      persistedValue: "sensitive"
    }), createHost(response, "en"));

    expect(response.body).toEqual({
      code: "QUOTATION_MONEY_MISMATCH",
      message: "Quotation totals are inconsistent.",
      statusCode: 409,
      field: "items.0.total",
      resourceId: "quotation-1",
      repairable: true
    });
    expect(response.body).not.toHaveProperty("persistedValue");
  });

  it("returns exhausted quotation repair conflicts as a stable recoverable 409", () => {
    const filter = new ApiErrorFilter();
    const response = createResponse();

    filter.catch(new ConflictException({
      code: "QUOTATION_MONEY_REPAIR_CONFLICT",
      message: "Quotation totals could not be recalculated because the quotation changed concurrently.",
      resourceId: "quotation-1",
      repairable: true,
      prismaCode: "P2034",
      financialData: "sensitive"
    }), createHost(response, "en"));

    expect(response.body).toEqual({
      code: "QUOTATION_MONEY_REPAIR_CONFLICT",
      message: "Quotation totals could not be recalculated because the quotation changed concurrently.",
      statusCode: 409,
      resourceId: "quotation-1",
      repairable: true
    });
    expect(response.body).not.toHaveProperty("prismaCode");
    expect(response.body).not.toHaveProperty("financialData");
  });

  it("normalizes unexpected errors and internal server errors without exposing stacks", () => {
    const filter = new ApiErrorFilter();
    const unexpected = createResponse();
    const explicit = createResponse();

    filter.catch(new Error("database password leaked"), createHost(unexpected, "en"));
    filter.catch(new InternalServerErrorException(), createHost(explicit, "en"));

    expect(unexpected.body).toEqual({
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error",
      statusCode: 500
    });
    expect(explicit.body?.message).toBe("Internal Server Error");
  });

  it("logs operational failures without password, email, hash, message, or stack", () => {
    const messages: string[] = [];
    const sink = collectingSink(messages);
    const logger = new SafeOperationalLogger(
      "api-error-filter",
      sink,
      () => Date.parse("2026-07-19T12:00:00.000Z")
    );
    const filter = new ApiErrorFilter(logger);
    const response = createResponse();
    const error = Object.assign(
      new Error("password=private email=ada@example.com hash=$argon2id$private"),
      { code: "ARGON2_NATIVE_FAILURE", token: "private-token" }
    );

    filter.catch(error, createHost(response, "en"));

    expect(response.body).toEqual({
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error",
      statusCode: 500
    });
    expect(messages).toHaveLength(1);
    expect(JSON.parse(messages[0] ?? "{}")).toEqual({
      event: "unhandled_error",
      component: "api-error-filter",
      errorName: "Error",
      errorCode: "ARGON2_NATIVE_FAILURE",
      timestamp: "2026-07-19T12:00:00.000Z"
    });
    expect(messages.join(" ")).not.toMatch(
      /password|ada@example\.com|argon2id|private-token|native verifier unavailable/i
    );
  });

  it("normalizes string exception bodies and empty validation arrays", () => {
    const filter = new ApiErrorFilter();
    const stringBody = createResponse();
    const emptyMessages = createResponse();

    filter.catch(new HttpException("Plain failure", 409), createHost(stringBody, "en"));
    filter.catch(new BadRequestException({ message: [], statusCode: 400 }), createHost(emptyMessages, "en"));

    expect(stringBody.body).toEqual({
      code: "CONFLICT",
      message: "Plain failure",
      statusCode: 409
    });
    expect(emptyMessages.body).toEqual({
      code: "BAD_REQUEST",
      message: "Request failed",
      statusCode: 400
    });
  });

  it("sets Retry-After for distributed rate limit failures", () => {
    const filter = new ApiErrorFilter();
    const response = createResponse();

    filter.catch(new RateLimitExceededException(47), createHost(response, "en"));

    expect(response.statusCode).toBe(429);
    expect(response.headers?.["Retry-After"]).toBe("47");
    expect(response.body?.code).toBe("TOO_MANY_REQUESTS");
  });
});

function createResponse(): TestResponse {
  return {
    headers: {},
    status(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
    json(body: TestBody) {
      this.body = body;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers = { ...this.headers, [name]: value };
    }
  };
}

function collectingSink(messages: string[]): OperationalLogSink {
  return {
    log: (message) => messages.push(message),
    warn: (message) => messages.push(message),
    error: (message) => messages.push(message)
  };
}

function createHost(response: ReturnType<typeof createResponse>, locale: string): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ headers: { "accept-language": locale } }),
      getNext: () => undefined
    }),
    getArgByIndex: () => undefined,
    getArgs: () => [],
    getType: () => "http",
    switchToRpc: () => ({
      getContext: () => undefined,
      getData: () => undefined
    }),
    switchToWs: () => ({
      getClient: () => undefined,
      getData: () => undefined,
      getPattern: () => undefined
    })
  } as unknown as ArgumentsHost;
}
