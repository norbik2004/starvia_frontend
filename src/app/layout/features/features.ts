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
  eyebrow: string;
  title: string;
  body: string;
};

const SUPPORTING_FEATURES: FeatureCard[] = [
  {
    eyebrow: 'Calendar',
    title: 'Kampanie, serie i pojedyncze posty mieszkaja w jednym kalendarzu.',
    body: 'Zespol widzi rytm publikacji, zaleznosci i priorytety bez recznego spinania tego w kilku narzedziach.',
  },
  {
    eyebrow: 'Brand voice',
    title: 'Jeden draft zamienia sie w wersje dopasowane do kazdego kanalu.',
    body: 'Zachowujesz spojny ton marki, ale bez przepisywania tresci od nowa dla LinkedIna, X czy Instagrama.',
  },
  {
    eyebrow: 'Review loop',
    title: 'Feedback i poprawki dzieja sie tam, gdzie tresc faktycznie powstaje.',
    body: 'Mniej chaosu w komentarzach i mniej zgadywania, ktora wersja jest finalna oraz gotowa do publikacji.',
  },
  {
    eyebrow: 'AI ops',
    title: 'AI wspiera produkcje, ale nie odrywa zespolu od realnego kontekstu kampanii.',
    body: 'Briefy, cele i poprzednie iteracje zostaja w obiegu, wiec kazdy kolejny draft zaczyna z lepszego miejsca.',
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
          <p class="section-eyebrow">System operacyjny dla contentu</p>
          <h2 class="section-title">Starvia laczy strategia, AI i publikacje w jeden operacyjny flow.</h2>
          <p class="section-lead">
            Zamiast dorzucac kolejny edytor, Starvia spina caly proces: od planowania kampanii po
            finalny post i kolejne iteracje zespolu.
          </p>
        </header>

        <article class="feature-spotlight" aria-labelledby="feature-ai-title">
          <div class="feature-spotlight__content">
            <p class="feature-spotlight__eyebrow">Execution gap</p>
            <h3 id="feature-ai-title" class="feature-spotlight__title">
              Tworca lub marketer nie powinien spedzac dnia na recznym koordynowaniu publikacji.
            </h3>
            <p class="feature-spotlight__lead">
              Starvia porzadkuje proces, w ktorym strategia, drafty, feedback i harmonogram
              wzajemnie sie napedzaja zamiast blokowac.
            </p>
            <div class="feature-spotlight__metrics" aria-label="Korzyści operacyjne">
              <div class="feature-spotlight__metric">
                <span class="feature-spotlight__metric-value">Jeden rytm</span>
                <span class="feature-spotlight__metric-label">od briefu do publikacji</span>
              </div>
              <div class="feature-spotlight__metric">
                <span class="feature-spotlight__metric-value">Mniej tarcia</span>
                <span class="feature-spotlight__metric-label">miedzy contentem, AI i review</span>
              </div>
            </div>
            <a routerLink="/register" class="feature-spotlight__link">Uruchom workflow w Starvia</a>
          </div>
        </article>

        <ul class="feature-grid">
          @for (item of supportingFeatures; track item.title) {
            <li class="feature-card">
              <p class="feature-card__eyebrow">{{ item.eyebrow }}</p>
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
