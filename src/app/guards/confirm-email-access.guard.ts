import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import {
  grantConfirmEmailAccess,
  hasValidConfirmEmailAccess,
  readConfirmEmailFromHistoryState,
} from '../pages/confirm-email/confirm-email-access';

/**
 * /confirm-email only after registration (router state + session ticket).
 * Typed URLs without a ticket are redirected to /register.
 */
export const confirmEmailAccessGuard: CanActivateFn = () => {
  const router = inject(Router);

  if (hasValidConfirmEmailAccess()) {
    return true;
  }

  const fromNav = readConfirmEmailFromHistoryState(router.getCurrentNavigation()?.extras.state);
  if (fromNav) {
    grantConfirmEmailAccess(fromNav);
    return true;
  }

  return router.createUrlTree(['/register']);
};
