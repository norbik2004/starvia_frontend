import { AfterViewInit, DestroyRef, Directive, inject, input, signal } from '@angular/core';

@Directive({
  selector: '[appPageReveal]',
  host: {
    '[class.page-reveal]': '!revealList()',
    '[class.page-reveal-list]': 'revealList()',
    '[class.page-reveal--ready]': 'ready() && !revealList()',
    '[class.page-reveal-list--ready]': 'ready() && revealList()',
  },
})
export class PageRevealDirective implements AfterViewInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly revealList = input(false, { alias: 'appPageRevealList' });
  readonly delayMs = input(0, { alias: 'appPageRevealDelay' });

  protected readonly ready = signal(false);

  ngAfterViewInit(): void {
    this.scheduleReveal();
  }

  private scheduleReveal(): void {
    this.ready.set(false);

    const delay = this.delayMs();
    const reveal = (): void => {
      requestAnimationFrame(() => {
        this.ready.set(true);
      });
    };

    if (delay > 0) {
      const timeoutId = window.setTimeout(reveal, delay);
      this.destroyRef.onDestroy(() => window.clearTimeout(timeoutId));
      return;
    }

    const frameId = requestAnimationFrame(() => {
      reveal();
    });
    this.destroyRef.onDestroy(() => cancelAnimationFrame(frameId));
  }
}
