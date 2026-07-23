import { animate, style, transition, trigger } from '@angular/animations';

const prefersReducedMotion =
  typeof globalThis !== 'undefined' &&
  globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;

const ENTER = prefersReducedMotion ? '0ms' : '160ms ease-out';
const LEAVE = prefersReducedMotion ? '0ms' : '120ms ease-in';
const PANEL_ENTER = prefersReducedMotion ? '0ms' : '160ms ease-out';
const PANEL_LEAVE = prefersReducedMotion ? '0ms' : '120ms ease-in';

export const postMetaChipAnimation = trigger('postMetaChip', [
  transition(':enter', [
    style({ opacity: 0 }),
    animate(ENTER, style({ opacity: 1 })),
  ]),
  transition(':leave', [
    animate(LEAVE, style({ opacity: 0 })),
  ]),
]);

export const postMetaFadeSlideAnimation = trigger('postMetaFadeSlide', [
  transition(':enter', [
    style({ opacity: 0 }),
    animate(PANEL_ENTER, style({ opacity: 1 })),
  ]),
  transition(':leave', [
    animate(PANEL_LEAVE, style({ opacity: 0 })),
  ]),
]);

export const postMetaPanelAnimation = trigger('postMetaPanel', [
  transition(':enter', [
    style({ opacity: 0 }),
    animate(PANEL_ENTER, style({ opacity: 1 })),
  ]),
  transition(':leave', [
    animate(PANEL_LEAVE, style({ opacity: 0 })),
  ]),
]);
