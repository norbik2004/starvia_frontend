import { DestroyRef, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

const AUTH_PAGE_BODY_CLASS = 'auth-page';

export function lockAuthPageBody(): void {
  const document = inject(DOCUMENT);
  const destroyRef = inject(DestroyRef);

  document.body.classList.add(AUTH_PAGE_BODY_CLASS);
  destroyRef.onDestroy(() => {
    document.body.classList.remove(AUTH_PAGE_BODY_CLASS);
  });
}
