import { animate, style, transition, trigger } from '@angular/animations';

const prefersReducedMotion =
  typeof globalThis !== 'undefined' &&
  globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;

const ENTER = prefersReducedMotion ? '0ms' : '220ms ease-out';
const LEAVE = prefersReducedMotion ? '0ms' : '180ms ease-in';
const PANEL_ENTER = prefersReducedMotion ? '0ms' : '200ms ease-out';
const PANEL_LEAVE = prefersReducedMotion ? '0ms' : '160ms ease-in';

export const postMetaChipAnimation = trigger('postMetaChip', [
  transition(':enter', [
    style({ opacity: 0, transform: 'scale(0.55)' }),
    animate(ENTER, style({ opacity: 1, transform: 'scale(1)' })),
  ]),
  transition(':leave', [
    animate(LEAVE, style({ opacity: 0, transform: 'scale(0.55)' })),
  ]),
]);

export const postMetaFadeSlideAnimation = trigger('postMetaFadeSlide', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(-3px)' }),
    animate(PANEL_ENTER, style({ opacity: 1, transform: 'translateY(0)' })),
  ]),
  transition(':leave', [
    animate(PANEL_LEAVE, style({ opacity: 0, transform: 'translateY(-3px)' })),
  ]),
]);

export const postMetaPanelAnimation = trigger('postMetaPanel', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(-0.35rem) scale(0.98)' }),
    animate(PANEL_ENTER, style({ opacity: 1, transform: 'translateY(0) scale(1)' })),
  ]),
  transition(':leave', [
    animate(PANEL_LEAVE, style({ opacity: 0, transform: 'translateY(-0.25rem) scale(0.98)' })),
  ]),
]);
