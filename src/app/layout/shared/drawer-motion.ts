import { Directive, ElementRef, OnDestroy, effect, inject, input } from '@angular/core';

export const DRAWER_MOTION_MS = 360;
const DRAWER_REDUCED_MOTION_MS = 180;
const DRAWER_SETTLE_MS = 24;

export type DrawerMotionState = 'closed' | 'open' | 'closing';
export type DrawerMotionSurface = 'panel' | 'backdrop';

export function drawerAnimationDuration(): number {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? DRAWER_REDUCED_MOTION_MS
    : DRAWER_MOTION_MS;
}

export function drawerMotionDelay(): number {
  return drawerAnimationDuration() + DRAWER_SETTLE_MS;
}

@Directive({
  selector: '[appDrawerMotion]',
})
export class DrawerMotionDirective implements OnDestroy {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private animation: Animation | null = null;

  readonly surface = input<DrawerMotionSurface>('panel', { alias: 'appDrawerMotion' });
  readonly state = input<DrawerMotionState>('closed', { alias: 'drawerMotionState' });
  readonly mobileOnly = input(false, { alias: 'drawerMotionMobileOnly' });

  constructor() {
    effect(() => {
      this.moveTo(this.surface(), this.state(), this.mobileOnly());
    });
  }

  ngOnDestroy(): void {
    this.animation?.cancel();
    this.animation = null;
  }

  private moveTo(
    surface: DrawerMotionSurface,
    state: DrawerMotionState,
    mobileOnly: boolean
  ): void {
    const element = this.elementRef.nativeElement;
    const shouldAnimate = !mobileOnly || window.matchMedia('(max-width: 48rem)').matches;

    if (!shouldAnimate) {
      this.animation?.cancel();
      this.animation = null;
      element.style.removeProperty('transform');
      element.style.removeProperty('opacity');
      element.style.removeProperty('visibility');
      element.style.removeProperty('pointer-events');
      return;
    }

    const currentStyle = getComputedStyle(element);
    const currentValue =
      surface === 'panel'
        ? currentStyle.transform === 'none'
          ? state === 'open'
            ? 'translateX(100%)'
            : 'translateX(0)'
          : currentStyle.transform
        : currentStyle.opacity;

    this.animation?.cancel();
    this.animation = null;

    if (state === 'closed') {
      this.applyFinalState(element, surface, state);
      return;
    }

    element.style.visibility = 'visible';
    element.style.pointerEvents = state === 'open' ? 'auto' : 'none';

    const targetValue =
      surface === 'panel'
        ? state === 'open'
          ? 'translateX(0)'
          : 'translateX(100%)'
        : state === 'open'
          ? '1'
          : '0';
    const keyframes =
      surface === 'panel'
        ? [{ transform: currentValue }, { transform: targetValue }]
        : [{ opacity: currentValue }, { opacity: targetValue }];
    const animation = element.animate(keyframes, {
      duration: drawerAnimationDuration(),
      easing: state === 'open' ? 'cubic-bezier(0.22, 1, 0.36, 1)' : 'cubic-bezier(0.4, 0, 1, 1)',
      fill: 'forwards',
    });

    this.animation = animation;
    void animation.finished
      .then(() => {
        if (this.animation !== animation) {
          return;
        }
        this.applyFinalState(element, surface, state);
        animation.cancel();
        this.animation = null;
      })
      .catch(() => undefined);
  }

  private applyFinalState(
    element: HTMLElement,
    surface: DrawerMotionSurface,
    state: DrawerMotionState
  ): void {
    const visible = state === 'open';

    if (surface === 'panel') {
      element.style.transform = visible ? 'translateX(0)' : 'translateX(100%)';
    } else {
      element.style.opacity = visible ? '1' : '0';
    }

    element.style.visibility = visible ? 'visible' : 'hidden';
    element.style.pointerEvents = visible ? 'auto' : 'none';
  }
}
