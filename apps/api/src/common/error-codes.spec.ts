import { codeForStatus, ERROR_CODES } from "./error-codes";

describe("error codes", () => {
  it.each([
    [400, ERROR_CODES.badRequest],
    [401, ERROR_CODES.unauthorized],
    [403, ERROR_CODES.forbidden],
    [404, ERROR_CODES.notFound],
    [409, ERROR_CODES.conflict],
    [429, ERROR_CODES.tooManyRequests],
    [418, ERROR_CODES.internalServerError],
    [500, ERROR_CODES.internalServerError]
  ])("maps HTTP %s to %s", (statusCode, code) => {
    expect(codeForStatus(statusCode)).toBe(code);
  });
});
