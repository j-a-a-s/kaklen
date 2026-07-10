import { BadRequestException, ArgumentsHost } from "@nestjs/common";
import { ApiErrorFilter } from "./api-error.filter";

interface TestBody {
  code: string;
  statusCode: number;
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
