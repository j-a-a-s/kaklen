import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger
} from "@nestjs/common";
import { Response } from "express";
import { ApiErrorResponse, codeForStatus } from "./error-codes";
import { RateLimitExceededException } from "./rate-limit-exceptions";
import { SafeOperationalLogger } from "./safe-operational-logger";
import {
  KokecoreError,
  RateLimitExceededException as KokecoreRateLimitExceededException
} from "@kokecore/errors";

interface HttpExceptionBody {
  code?: string;
  message?: string | string[];
  statusCode?: number;
  field?: string;
  resourceId?: string;
  repairable?: boolean;
}

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  constructor(
    private readonly operationalLogger = new SafeOperationalLogger(
      "api-error-filter",
      new Logger(ApiErrorFilter.name)
    )
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof KokecoreError) {
      const body = exception.toJSON();
      response.status(body.statusCode).json({
        code: body.code,
        message: body.message,
        statusCode: body.statusCode,
        ...(typeof body.field === "string" ? { field: body.field } : {}),
        ...(typeof body.resourceId === "string" ? { resourceId: body.resourceId } : {}),
        ...(typeof body.repairable === "boolean" ? { repairable: body.repairable } : {})
      });
      if (exception instanceof KokecoreRateLimitExceededException) {
        response.setHeader("Retry-After", String(exception.retryAfterSeconds));
      }
      return;
    }

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? this.normalizeBody(exception.getResponse()) : {};
    const payload: ApiErrorResponse = {
      code: body.code && typeof body.code === "string" ? body.code : codeForStatus(statusCode),
      message: this.messageForBody(body, statusCode),
      statusCode,
      ...(typeof body.field === "string" ? { field: body.field } : {}),
      ...(typeof body.resourceId === "string" ? { resourceId: body.resourceId } : {}),
      ...(typeof body.repairable === "boolean" ? { repairable: body.repairable } : {})
    };

    if (exception instanceof RateLimitExceededException) {
      response.setHeader("Retry-After", String(exception.retryAfterSeconds));
    }
    if (!(exception instanceof HttpException)) {
      this.operationalLogger.write("error", "unhandled_error", { error: exception });
    }

    response.status(statusCode).json(payload);
  }

  private normalizeBody(body: string | object): HttpExceptionBody {
    if (typeof body === "string") {
      return { message: body };
    }
    return body as HttpExceptionBody;
  }

  private messageForBody(body: HttpExceptionBody, statusCode: number): string {
    if (Array.isArray(body.message)) {
      return body.message[0] ?? this.defaultMessage(statusCode);
    }
    return body.message ?? this.defaultMessage(statusCode);
  }

  private defaultMessage(statusCode: number): string {
    if (statusCode === HttpStatus.INTERNAL_SERVER_ERROR) {
      return "Internal server error";
    }
    return "Request failed";
  }
}
