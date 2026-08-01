import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { createHeroStars } from '../shared/section-stars';
import { createSectionStarsInteraction } from '../shared/section-stars-pointer';
import { SectionStarsLayer } from '../shared/section-stars-layer';
import { HeroConstellation } from './hero-constellation';

@Component({
  selector: 'app-hero',
  imports: [RouterLink, SectionStarsLayer, HeroConstellation],
  styleUrl: './hero.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.hero-host--fill]': 'fillViewport',
    '[class.hero-host--marketing]': 'isMarketing',
  },
  template: `
    <section
      id="top"
      class="page-section hero"
      [class.hero--fill-viewport]="fillViewport"
      [class.hero--marketing]="isMarketing"
      [class.hero--with-panel]="showPanel"
      (mousemove)="starsInteraction.onPointerMove($event)"
      (mouseleave)="starsInteraction.onPointerLeave()"
    >
      <div class="hero-bg" aria-hidden="true">
        <app-section-stars-layer
          class="hero-stars"
          [stars]="stars"
          [nearIds]="starsInteraction.nearStarIds()"
        />
      </div>

      <div class="hero-inner">
        <div class="hero-layout" [class.hero-layout--marketing]="isMarketing">
          <div class="hero-copy">
            @if (eyebrow) {
              <p class="hero-eyebrow">
                @if (isMarketing) {
                  <span class="material-icons hero-eyebrow__icon" aria-hidden="true">wand_stars</span>
                } @else {
                  <span class="hero-eyebrow__dot" aria-hidden="true"></span>
                }
                {{ eyebrow }}
              </p>
            }
            <h1 class="hero-title t-display">
              @if (isMarketing && headingTop && headingBottom) {
                <span class="hero-title__line hero-title__line--top">{{ headingTop }}</span>
                <span class="hero-title__line hero-title__line--bottom">{{ headingBottom }}</span>
              } @else if (heading) {
                {{ heading }}
              } @else if (isMarketing) {
                {{ title }}
              } @else {
                Twórz posty, które <span class="hero-title__accent">łączą</span> z {{ title }}
              }
            </h1>
            <p class="hero-lead t-body">{{ description }}</p>
            @if (isMarketing && kicker) {
              <p class="hero-kicker">{{ kicker }}</p>
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

          @if (showPanel) {
            <figure
              class="media-frame media-frame--hero"
              [class.media-frame--hero-visual]="isMarketing"
            >
              <figcaption class="sr-only">{{ panelCaption }}</figcaption>
              @if (customPanel) {
                <ng-content select="[hero-panel]" />
              } @else if (panelImage) {
                <img
                  class="hero-panel-image"
                  [src]="panelImage"
                  [alt]="panelImageAlt"
                  width="1536"
                  height="1024"
                  decoding="async"
                  fetchpriority="high"
                />
              } @else if (isMarketing) {
                <div class="hero-constellation">
                  <app-hero-constellation />
                </div>
              } @else {
                <div class="media-slot hero-media-placeholder" aria-hidden="true">
                  <span class="media-slot__icon" aria-hidden="true">{{ panelIcon }}</span>
                  <p class="media-slot__label">{{ panelLabel }}</p>
                  <p class="media-slot__hint">{{ panelHint }}</p>
                </div>
              }
            </figure>
          }
        </div>
      </div>
    </section>
  `,
})
export class Hero implements AfterViewInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly stars = createHeroStars();
  protected readonly starsInteraction = createSectionStarsInteraction(this.stars);

  @Input() title = 'Starvia';
  @Input() eyebrow: string | null = null;
  @Input() headingTop: string | null = null;
  @Input() headingBottom: string | null = null;
  @Input() heading: string | null = null;
  @Input() description =
    'Planuj, pisz i publikuj tresci, ktore przyciagaja uwage. Wszystko w jednym spokojnym miejscu - bez chaosu narzedzi.';
  @Input() kicker: string | null =
    'Dla tworcow, marketerow i zespolow, ktore publikuja regularnie.';
  @Input() showActions = true;
  @Input() primaryActionLabel = 'Zacznij za darmo';
  @Input() primaryActionHref = '#features';
  @Input() primaryActionRoute: string | null = '/register';
  @Input() secondaryActionLabel = 'Zobacz funkcje';
  @Input() secondaryActionRoute: string | null = null;
  @Input() secondaryActionHref: string | null = '#features';
  @Input() fillViewport = false;
  @Input() customPanel = false;
  @Input() panelCaption = 'Orbitujące ikony ekosystemu Starvia';
  /** Ustaw sciezke do wlasnej grafiki hero, np. `/starvia-hero.png`. */
  @Input() panelImage: string | null = null;
  @Input() panelImageAlt = 'Podglad sekcji Posty w Starvia';
  @Input() panelIcon = '▣';
  @Input() panelLabel = 'Miejsce na grafike';
  @Input() panelHint = 'Wstaw tu wlasny podglad produktu (np. /starvia-hero.png)';

  protected get isMarketing(): boolean {
    return !this.fillViewport && !this.customPanel;
  }

  protected get showPanel(): boolean {
    return this.customPanel || this.isMarketing;
  }

  ngAfterViewInit(): void {
    const section = this.host.nativeElement.querySelector('section');
    if (section instanceof HTMLElement) {
      this.starsInteraction.attach(section);
    }
  }

  ngOnDestroy(): void {
    this.starsInteraction.destroy();
  }
}
