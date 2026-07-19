import { BadRequestException, ArgumentsHost, ConflictException, HttpException, InternalServerErrorException } from "@nestjs/common";
import { ApiErrorFilter } from "./api-error.filter";

interface TestBody {
  code: string;
  message: string;
  statusCode: number;
  field?: string;
}

interface TestResponse {
  statusCode?: number;
  body?: TestBody;
  status(statusCode: number): TestResponse;
  json(body: TestBody): TestResponse;
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
      persistedValue: "sensitive"
    }), createHost(response, "en"));

    expect(response.body).toEqual({
      code: "QUOTATION_MONEY_MISMATCH",
      message: "Quotation totals are inconsistent.",
      statusCode: 409,
      field: "items.0.total"
    });
    expect(response.body).not.toHaveProperty("persistedValue");
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
});

function createResponse(): TestResponse {
  return {
    status(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
    json(body: TestBody) {
      this.body = body;
      return this;
    }
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
