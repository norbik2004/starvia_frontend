import { AfterViewInit, DestroyRef, Directive, ElementRef, inject, input, signal } from '@angular/core';

@Directive({
  selector: '[appPageReveal]',
  host: {
    '[class.page-reveal]': 'revealEnabled() && !revealList()',
    '[class.page-reveal-list]': 'revealEnabled() && revealList()',
    '[class.page-reveal--ready]': 'revealEnabled() && ready() && !revealList()',
    '[class.page-reveal-list--ready]': 'revealEnabled() && ready() && revealList()',
  },
})
export class PageRevealDirective implements AfterViewInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly revealList = input(false, { alias: 'appPageRevealList' });
  readonly delayMs = input(0, { alias: 'appPageRevealDelay' });

  protected readonly revealEnabled = signal(false);
  protected readonly ready = signal(false);

  ngAfterViewInit(): void {
    const hostEl = this.host.nativeElement;

    if (hostEl.closest('.dashboard-layout') !== null) {
      hostEl.classList.add(this.revealList() ? 'dashboard-page-reveal-list' : 'dashboard-page-reveal');
      return;
    }

    this.revealEnabled.set(true);
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
