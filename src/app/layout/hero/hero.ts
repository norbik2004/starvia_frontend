import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  Input,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-hero',
  imports: [RouterLink],
  styleUrl: './hero.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.hero-host--fill]': 'fillViewport',
    '[class.hero-host--marketing]': 'isMarketing',
    '[class.hero-host--ready]': 'entered()',
    '[class.hero-host--compact]': 'compact()',
    // Prevent native tooltip — `title` input must not leak as host title attribute.
    '[attr.title]': 'null',
  },
  template: `
    <section
      id="top"
      class="page-section hero"
      [class.hero--fill-viewport]="fillViewport"
      [class.hero--marketing]="isMarketing"
      [class.hero--with-panel]="showPanel"
      [style.--hero-px]="parallaxX()"
      [style.--hero-py]="parallaxY()"
    >
      <div class="hero-bg" aria-hidden="true">
        @if (isMarketing) {
          <span class="hero-orb hero-orb--a"></span>
          <span class="hero-orb hero-orb--b"></span>
          <span class="hero-orb hero-orb--c"></span>
          <span class="hero-grid"></span>
        }
      </div>

      <div class="hero-inner">
        <div class="hero-layout" [class.hero-layout--marketing]="isMarketing">
          <div class="hero-copy">
            @if (isMarketing) {
              <p class="hero-brand">
                <span class="hero-brand__text">{{ brandName }}</span>
                <span class="hero-brand__line" aria-hidden="true"></span>
              </p>
              @if (eyebrow) {
                <p class="hero-eyebrow">{{ eyebrow }}</p>
              }
              <h1 class="hero-title t-display">{{ heading || defaultMarketingHeading }}</h1>
            } @else {
              @if (eyebrow) {
                <p class="hero-eyebrow">
                  <span class="hero-eyebrow__dot" aria-hidden="true"></span>
                  {{ eyebrow }}
                </p>
              }
              <h1 class="hero-title t-display">
                @if (heading) {
                  {{ heading }}
                } @else {
                  Twórz posty, które <span class="hero-title__accent">łączą</span> z {{ brandName }}
                }
              </h1>
            }

            <p class="hero-lead t-body">{{ description }}</p>

            @if (isMarketing) {
              <ul class="hero-platforms" aria-label="Wspierane platformy">
                @for (platform of platforms; track platform) {
                  <li class="hero-platforms__item">{{ platform }}</li>
                }
              </ul>
            }

            @if (showActions) {
              <div class="hero-actions">
                @if (primaryActionRoute; as route) {
                  <a [routerLink]="route" class="btn btn--primary btn--hero-primary">{{ primaryActionLabel }}</a>
                } @else {
                  <a [href]="primaryActionHref" class="btn btn--primary btn--hero-primary">{{ primaryActionLabel }}</a>
                }

                @if (secondaryActionRoute; as route) {
                  <a [routerLink]="route" class="btn btn--secondary btn--hero-secondary">{{ secondaryActionLabel }}</a>
                } @else if (secondaryActionHref; as href) {
                  <a [href]="href" class="btn btn--secondary btn--hero-secondary">{{ secondaryActionLabel }}</a>
                }
              </div>
            }
            <ng-content select="[hero-copy-extra]" />
          </div>

          @if (showPanel && !compact()) {
            <div class="hero-visual" [class.hero-visual--marketing]="isMarketing">
              @if (isMarketing) {
                <div class="hero-float hero-float--ai" aria-hidden="true">
                  <span class="hero-float__dot"></span>
                  AI draft ready
                </div>
                <div class="hero-float hero-float--cal" aria-hidden="true">
                  <span class="hero-float__dot hero-float__dot--muted"></span>
                  Scheduled · 09:30
                </div>
              }

              <figure class="media-frame media-frame--hero" [class.media-frame--hero-visual]="isMarketing">
                <figcaption class="sr-only">{{ panelCaption }}</figcaption>
                @if (customPanel) {
                  <ng-content select="[hero-panel]" />
                } @else if (resolvedPanelImage; as image) {
                  <img
                    class="hero-panel-image"
                    [src]="image"
                    alt=""
                    width="1536"
                    height="864"
                    decoding="async"
                    fetchpriority="high"
                  />
                } @else {
                  <div class="media-slot hero-media-placeholder" aria-hidden="true">
                    <span class="media-slot__icon" aria-hidden="true">{{ panelIcon }}</span>
                    <p class="media-slot__label">{{ panelLabel }}</p>
                    <p class="media-slot__hint">{{ panelHint }}</p>
                  </div>
                }
              </figure>
            </div>
          }
        </div>
      </div>

      @if (isMarketing) {
        <a class="hero-scroll" href="#features" aria-label="Przejdź do funkcji">
          <span class="hero-scroll__label">Scroll</span>
          <span class="hero-scroll__chevron" aria-hidden="true"></span>
        </a>
      }
    </section>
  `,
})
export class Hero implements AfterViewInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private reduceMotion = false;
  private rafId = 0;
  private compactMq: MediaQueryList | null = null;

  protected readonly defaultMarketingHeading = 'AI do zarządzania social media';
  protected readonly platforms = ['Facebook', 'Instagram', 'LinkedIn'] as const;
  protected readonly entered = signal(false);
  protected readonly compact = signal(
    typeof window !== 'undefined' && window.matchMedia('(max-width: 55.99rem)').matches,
  );
  protected readonly parallaxX = signal('0px');
  protected readonly parallaxY = signal('0px');

  private readonly onCompactChange = (event: MediaQueryListEvent): void => {
    this.compact.set(event.matches);
  };

  @Input() brandName = 'Starvia';
  @Input() eyebrow: string | null = null;
  @Input() heading: string | null = null;
  @Input() description =
    'Planuj, pisz i publikuj treści, które przyciągają uwagę. Wszystko w jednym spokojnym miejscu.';
  @Input() kicker: string | null = null;
  @Input() showActions = true;
  @Input() primaryActionLabel = 'Zacznij za darmo';
  @Input() primaryActionHref = '#features';
  @Input() primaryActionRoute: string | null = '/register';
  @Input() secondaryActionLabel = 'Zobacz jak działa';
  @Input() secondaryActionRoute: string | null = null;
  @Input() secondaryActionHref: string | null = '#features';
  @Input() fillViewport = false;
  @Input() customPanel = false;
  @Input() panelCaption = 'Podgląd workspace';
  @Input() panelImage: string | null = null;
  @Input() panelImageAlt = 'Podgląd kalendarza treści i asystenta AI';
  @Input() panelIcon = '▣';
  @Input() panelLabel = 'Miejsce na grafikę';
  @Input() panelHint = 'Wstaw tu własny podgląd produktu';

  protected get isMarketing(): boolean {
    return !this.fillViewport && !this.customPanel;
  }

  protected get showPanel(): boolean {
    return this.customPanel || this.isMarketing;
  }

  protected get resolvedPanelImage(): string | null {
    if (this.panelImage) {
      return this.panelImage;
    }
    return this.isMarketing ? '/marketing/hero-workspace.png' : null;
  }

  ngAfterViewInit(): void {
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.compactMq = window.matchMedia('(max-width: 55.99rem)');
    this.compact.set(this.compactMq.matches);
    this.compactMq.addEventListener('change', this.onCompactChange);
    requestAnimationFrame(() => this.entered.set(true));
  }

  ngOnDestroy(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    this.compactMq?.removeEventListener('change', this.onCompactChange);
  }

  @HostListener('mousemove', ['$event'])
  protected onPointerMove(event: MouseEvent): void {
    if (!this.isMarketing || this.reduceMotion) {
      return;
    }

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }

    this.rafId = requestAnimationFrame(() => {
      const rect = this.host.nativeElement.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      this.parallaxX.set(`${(x * 14).toFixed(2)}px`);
      this.parallaxY.set(`${(y * 10).toFixed(2)}px`);
    });
  }

  @HostListener('mouseleave')
  protected onPointerLeave(): void {
    this.parallaxX.set('0px');
    this.parallaxY.set('0px');
  }
}
