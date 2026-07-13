import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { Response } from "express";
import { ApiErrorResponse, codeForStatus } from "./error-codes";

interface HttpExceptionBody {
  code?: string;
  message?: string | string[];
  statusCode?: number;
}

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? this.normalizeBody(exception.getResponse()) : {};
    const payload: ApiErrorResponse = {
      code: body.code && typeof body.code === "string" ? body.code : codeForStatus(statusCode),
      message: this.messageForBody(body, statusCode),
      statusCode
    };

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
