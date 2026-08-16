import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import {
  hasValidEmailConfirmedAccess,
  isEmailConfirmedTicketUsed,
  readEmailConfirmedTicket,
} from '../pages/email-confirmed/email-confirmed-access';

/**
 * Blocks finger-typed /email-confirmed?status=...
 * Allows only:
 * - short-lived session ticket after a real callback was claimed
 * - callback with status + unused one-time ticket|token|code
 */
export const emailConfirmedAccessGuard: CanActivateFn = (route) => {
  const router = inject(Router);

  if (hasValidEmailConfirmedAccess()) {
    return true;
  }

  const status = route.queryParamMap.get('status');
  const ticket = readEmailConfirmedTicket(route.queryParamMap);

  if ((status === 'success' || status === 'error') && ticket && !isEmailConfirmedTicketUsed(ticket)) {
    return true;
  }

  return router.createUrlTree(['/login']);
};
