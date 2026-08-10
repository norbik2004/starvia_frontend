import { AfterViewInit, Directive, ElementRef, OnDestroy, inject, input, signal } from '@angular/core';

@Directive({
  selector: '[appScrollReveal]',
  host: {
    class: 'scroll-reveal',
    '[class.scroll-reveal--ready]': 'ready()',
  },
})
export class ScrollRevealDirective implements AfterViewInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private observer: IntersectionObserver | null = null;

  readonly delay = input(0, { alias: 'appScrollRevealDelay' });
  protected readonly ready = signal(false);

  ngAfterViewInit(): void {
    const el = this.host.nativeElement;
    el.style.setProperty('--reveal-delay', `${this.delay()}ms`);

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.ready.set(true);
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.ready.set(true);
            this.observer?.disconnect();
            this.observer = null;
            break;
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    );

    this.observer.observe(el);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
