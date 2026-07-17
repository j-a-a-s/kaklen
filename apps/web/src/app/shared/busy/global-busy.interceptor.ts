import { HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { finalize } from "rxjs/operators";
import { GlobalBusyService } from "./global-busy.service";

const BACKGROUND_HEADER = "x-kaklen-background";

export const globalBusyInterceptor: HttpInterceptorFn = (request, next) => {
  const background =
    request.headers.has(BACKGROUND_HEADER) ||
    request.url.includes("/health") ||
    request.url.endsWith("/auth/refresh");
  const outgoing = request.headers.has(BACKGROUND_HEADER)
    ? request.clone({ headers: request.headers.delete(BACKGROUND_HEADER) })
    : request;
  if (background) {
    return next(outgoing);
  }
  const operation = inject(GlobalBusyService).begin();
  return next(outgoing).pipe(finalize(() => operation.end()));
};
