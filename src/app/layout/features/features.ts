import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { createFeaturesStars } from '../shared/section-stars';
import { createSectionStarsInteraction } from '../shared/section-stars-pointer';
import { SectionStarsLayer } from '../shared/section-stars-layer';

type FeatureCard = {
  title: string;
  body: string;
};

const SUPPORTING_FEATURES: FeatureCard[] = [
  {
    title: 'Planuj i publikuj',
    body: 'Układaj kampanie, ustawiaj kolejkę postów i publikuj według harmonogramu — bez skakania między narzędziami.',
  },
  {
    title: 'Jeden draft, wiele kanałów',
    body: 'Napisz raz i dopasuj treść do każdej sieci, żeby przekaz był spójny i zgodny z marką.',
  },
  {
    title: 'Wgląd, który ma sens',
    body: 'Zobacz, co rezonuje, dopracuj strategię i stawiaj na treści, które realnie budują zaangażowanie.',
  },
];

@Component({
  selector: 'app-features',
  imports: [RouterLink, SectionStarsLayer],
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
        class="features-stars"
        [stars]="stars"
        [nearIds]="starsInteraction.nearStarIds()"
      />

      <div class="section-inner">
        <header class="section-header section-header--centered">
          <p class="section-eyebrow">Platforma</p>
          <h2 class="section-title">Wszystko, czego potrzebujesz, by rosnąć w social media.</h2>
          <p class="section-lead">
            Planowanie, pisanie z AI i publikacja w jednym miejscu — żeby zespół szybciej
            dostarczał lepsze treści.
          </p>
        </header>

        <article class="feature-spotlight" aria-labelledby="feature-ai-title">
          <div class="feature-spotlight__content">
            <p class="feature-spotlight__eyebrow">Pisanie z AI</p>
            <h3 id="feature-ai-title" class="feature-spotlight__title">
              Inteligentne treści, które brzmią jak Ty.
            </h3>
            <p class="feature-spotlight__lead">
              Zamieniaj briefy w dopracowane posty, haki i podpisy dopasowane do marki — i zyskuj
              godziny co tydzień.
            </p>
            <a routerLink="/register" class="feature-spotlight__link">Zacznij tworzyć</a>
          </div>
        </article>

        <ul class="feature-grid">
          @for (item of supportingFeatures; track item.title) {
            <li class="feature-card">
              <h3 class="feature-card__title">{{ item.title }}</h3>
              <p class="feature-card__body">{{ item.body }}</p>
            </li>
          }
        </ul>
      </div>
    </section>
  `,
})
export class Features implements AfterViewInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly supportingFeatures = SUPPORTING_FEATURES;
  protected readonly stars = createFeaturesStars();
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
