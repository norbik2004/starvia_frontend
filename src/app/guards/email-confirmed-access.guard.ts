import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { readEmailConfirmationCallback } from '../pages/email-confirmed/email-confirmed-access';

/**
 * The backend is the source of truth for the callback. This guard only rejects
 * malformed links before the page attempts verification.
 */
export const emailConfirmedAccessGuard: CanActivateFn = (route) => {
  const router = inject(Router);

  return readEmailConfirmationCallback(route.queryParamMap)
    ? true
    : router.createUrlTree(['/login']);
};
