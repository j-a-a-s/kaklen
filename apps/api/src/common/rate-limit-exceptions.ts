import { HttpException, HttpStatus, ServiceUnavailableException } from "@nestjs/common";
import { ERROR_CODES } from "./error-codes";

export class RateLimitExceededException extends HttpException {
  constructor(readonly retryAfterSeconds: number, message = "Too many requests") {
    super({ code: ERROR_CODES.tooManyRequests, message }, HttpStatus.TOO_MANY_REQUESTS);
  }
}

export class RateLimitBackendUnavailableException extends ServiceUnavailableException {
  constructor() {
    super({
      code: ERROR_CODES.rateLimitBackendUnavailable,
      message: "Rate limit service is temporarily unavailable"
    });
  }
}

export class AuthDeliveryUnavailableException extends ServiceUnavailableException {
  constructor() {
    super({
      code: ERROR_CODES.authDeliveryUnavailable,
      message: "Authentication delivery service is temporarily unavailable"
    });
  }
}
