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

@Component({
  selector: 'app-hero',
  imports: [RouterLink, SectionStarsLayer],
  styleUrl: './hero.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.hero-host--fill]': 'fillViewport',
  },
  template: `
    <section
      id="top"
      class="page-section hero"
      [class.hero--fill-viewport]="fillViewport"
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
        <div class="hero-layout">
          <div class="hero-copy">
            <p class="hero-eyebrow">
              <span class="hero-eyebrow__dot" aria-hidden="true"></span>
              {{ eyebrow }}
            </p>
            <h1 class="hero-title t-display">
              @if (heading) {
                {{ heading }}
              } @else {
                Create posts that <span class="hero-title__accent">connect</span> with {{ title }}
              }
            </h1>
            <p class="hero-lead t-body">{{ description }}</p>
            @if (showActions) {
              <div class="hero-actions">
                @if (primaryActionRoute; as route) {
                  <a [routerLink]="route" class="btn btn--raised-primary">{{ primaryActionLabel }}</a>
                } @else {
                  <a [href]="primaryActionHref" class="btn btn--raised-primary">{{ primaryActionLabel }}</a>
                }

                @if (secondaryActionRoute; as route) {
                  <a [routerLink]="route" class="btn btn--raised-secondary">{{ secondaryActionLabel }}</a>
                } @else if (secondaryActionHref; as href) {
                  <a [href]="href" class="btn btn--raised-secondary">{{ secondaryActionLabel }}</a>
                }
              </div>
            }
            <ng-content select="[hero-copy-extra]" />
          </div>

          <figure class="media-frame media-frame--hero">
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
            } @else {
              <div class="media-slot" aria-hidden="true">
                <span class="media-slot__icon" aria-hidden="true">{{ panelIcon }}</span>
                <p class="media-slot__label">{{ panelLabel }}</p>
                <p class="media-slot__hint">{{ panelHint }}</p>
              </div>
            }
          </figure>
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
  @Input() eyebrow = 'Social content, elevated';
  @Input() heading: string | null = null;
  @Input() description =
    'Plan, write, and publish engaging social content in one place with AI that sparks ideas, sharpens your message, and saves your team hours every week.';
  @Input() showActions = true;
  @Input() primaryActionLabel = 'Explore features';
  @Input() primaryActionHref = '#features';
  @Input() primaryActionRoute: string | null = null;
  @Input() secondaryActionLabel = 'Log in';
  @Input() secondaryActionRoute: string | null = '/login';
  @Input() secondaryActionHref: string | null = null;
  @Input() fillViewport = false;
  @Input() customPanel = false;
  @Input() panelCaption = 'Starvia product preview';
  @Input() panelImage: string | null = '/starvia-hero.png';
  @Input() panelImageAlt = 'Starvia content planner with AI writing assist and scheduling';
  @Input() panelIcon = '▣';
  @Input() panelLabel = 'Product preview';
  @Input() panelHint = 'App screenshot or hero illustration';

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
