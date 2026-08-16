import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { SessionService } from '../services/session';

export const bearerTokenInterceptor: HttpInterceptorFn = (request, next) => {
  if (!isBackendRequest(request.url)) {
    return next(request);
  }

  const session = inject(SessionService);
  const accessToken = session.getAccessToken();
  const authenticatedRequest = accessToken
    ? request.clone({
        setHeaders: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
    : request;

  return next(authenticatedRequest).pipe(
    catchError((error: unknown) => {
      if (accessToken && error instanceof HttpErrorResponse && error.status === 401) {
        session.setLoggedOut();
      }

      return throwError(() => error);
    }),
  );
};

function isBackendRequest(requestUrl: string): boolean {
  try {
    const backendUrl = new URL(environment.backendUrl);
    const url = new URL(requestUrl, backendUrl);

    return url.origin === backendUrl.origin && url.pathname.startsWith(backendUrl.pathname);
  } catch {
    return false;
  }
}
