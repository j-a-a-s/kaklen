import { HttpErrorResponse, HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { from, throwError } from "rxjs";
import { catchError, switchMap } from "rxjs/operators";
import { AuthService } from "./auth.service";

const API_URL = "http://localhost:3000/api";
const RETRY_HEADER = "x-kaklen-auth-retry";

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  const accessToken = authService.getAccessToken();
  const isApiRequest = request.url.startsWith(API_URL);
  const isAuthRefresh = request.url.endsWith("/auth/refresh");
  const hasRetried = request.headers.has(RETRY_HEADER);

  const authenticatedRequest =
    accessToken && isApiRequest
      ? request.clone({
          setHeaders: { Authorization: `Bearer ${accessToken}` },
          withCredentials: true
        })
      : request.clone({ withCredentials: isApiRequest || request.withCredentials });

  return next(authenticatedRequest).pipe(
    catchError((error: unknown) => {
      const shouldRefresh =
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        isApiRequest &&
        !isAuthRefresh &&
        !hasRetried;

      if (!shouldRefresh) {
        return throwError(() => error);
      }

      return from(authService.refresh()).pipe(
        switchMap(() => {
          const nextToken = authService.getAccessToken();
          const retryRequest = request.clone({
            setHeaders: {
              ...(nextToken ? { Authorization: `Bearer ${nextToken}` } : {}),
              [RETRY_HEADER]: "true"
            },
            withCredentials: true
          });

          return next(retryRequest);
        }),
        catchError((refreshError: unknown) => throwError(() => refreshError))
      );
    })
  );
};
