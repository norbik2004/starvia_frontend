import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  inject,
} from '@angular/core';
import { createFeaturesStars } from '../shared/section-stars';
import { createSectionStarsInteraction } from '../shared/section-stars-pointer';
import { SectionStarsLayer } from '../shared/section-stars-layer';

type FeatureCard = {
  title: string;
  body: string;
  mediaLabel: string;
  mediaHint: string;
};

const AI_BENEFITS = [
  'Generate engaging posts and captions in seconds',
  'Spark fresh marketing angles and content ideas',
  'Save hours on drafting while keeping your brand voice',
  'Strengthen social communication across every channel',
] as const;

const SUPPORTING_FEATURES: FeatureCard[] = [
  {
    title: 'Plan & schedule',
    body: 'Organize campaigns, queue posts, and publish on your timeline—without jumping between tools.',
    mediaLabel: 'Calendar view',
    mediaHint: 'Scheduling UI screenshot',
  },
  {
    title: 'Publish everywhere',
    body: 'Draft once and adapt for each network so your message stays consistent and on-brand.',
    mediaLabel: 'Channel preview',
    mediaHint: 'Multi-platform preview',
  },
  {
    title: 'Insights that matter',
    body: 'See what resonates, refine your strategy, and double down on content that drives engagement.',
    mediaLabel: 'Analytics',
    mediaHint: 'Performance dashboard',
  },
];

const FEATURES_ZIGZAG_FILL =
  'M0,20 L0,7 L75,20 L150,6 L225,20 L300,7 L375,20 L450,6 L525,20 L600,7 L675,20 L750,6 L825,20 L900,7 L975,20 L1050,6 L1125,20 L1200,7 L1200,20 Z';

@Component({
  selector: 'app-features',
  imports: [SectionStarsLayer],
  styleUrl: './features.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      id="features"
      class="page-section features"
      (mousemove)="starsInteraction.onPointerMove($event)"
      (mouseleave)="starsInteraction.onPointerLeave()"
    >
      <app-section-stars-layer
        [stars]="stars"
        [nearIds]="starsInteraction.nearStarIds()"
      />

      <div class="section-inner">
        <header class="section-header">
          <p class="section-eyebrow">Platform</p>
          <h2 class="section-title">Everything you need to grow on social</h2>
          <p class="section-lead">
            Starvia brings planning, AI-assisted writing, and publishing together so your team
            ships better content faster.
          </p>
        </header>

        <article class="feature-spotlight" aria-labelledby="feature-ai-title">
          <div class="feature-spotlight__media">
            <figure class="media-frame media-frame--feature">
              <figcaption class="sr-only">AI writing assistant product preview</figcaption>
              <div class="media-slot" aria-hidden="true">
                <span class="media-slot__icon" aria-hidden="true">AI</span>
                <p class="media-slot__label">AI writing assistant</p>
                <p class="media-slot__hint">Product screenshot or demo video</p>
              </div>
            </figure>
          </div>

          <div class="feature-spotlight__content">
            <span class="feature-badge">AI-powered</span>
            <h3 id="feature-ai-title" class="feature-spotlight__title t-h3">
              Smart content that sounds like you
            </h3>
            <p class="feature-spotlight__lead t-body">
              Our AI model helps you create high-quality, engaging social posts—turning briefs into
              polished copy, hooks, and captions that fit your brand.
            </p>
            <ul class="benefit-list">
              @for (benefit of aiBenefits; track benefit) {
                <li class="benefit-list__item t-body-sm">{{ benefit }}</li>
              }
            </ul>
          </div>
        </article>

        <ul class="feature-grid">
          @for (item of supportingFeatures; track item.title) {
            <li class="feature-card">
              <figure class="media-frame media-frame--card">
                <figcaption class="sr-only">{{ item.mediaLabel }} preview</figcaption>
                <div class="media-slot media-slot--compact" aria-hidden="true">
                  <span class="media-slot__icon" aria-hidden="true">+</span>
                  <p class="media-slot__label">{{ item.mediaLabel }}</p>
                  <p class="media-slot__hint">{{ item.mediaHint }}</p>
                </div>
              </figure>
              <h3 class="feature-card__title t-h3">{{ item.title }}</h3>
              <p class="feature-card__body t-body-sm">{{ item.body }}</p>
            </li>
          }
        </ul>
      </div>

      <div class="features-end" aria-hidden="true">
        <svg
          class="features-end__svg"
          viewBox="0 0 1200 20"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path [attr.d]="zigzagFill" />
        </svg>
      </div>
    </section>
  `,
})
export class Features implements AfterViewInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly aiBenefits = AI_BENEFITS;
  protected readonly supportingFeatures = SUPPORTING_FEATURES;
  protected readonly stars = createFeaturesStars();
  protected readonly zigzagFill = FEATURES_ZIGZAG_FILL;
  protected readonly starsInteraction = createSectionStarsInteraction(this.stars);

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
