import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ScrollRevealDirective } from '../../directives/scroll-reveal';

type FeatureBeat = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  image: string;
  imageAlt: string;
};

const FEATURE_BEATS: FeatureBeat[] = [
  {
    id: 'content',
    eyebrow: 'Zarządzanie treścią',
    title: 'Jeden workspace na drafty, wersje i statusy.',
    body: 'Trzymaj posty, briefy i poprawki w jednym miejscu. Wiesz, co jest w trakcie, co czeka na akceptację i co idzie na live.',
    image: '/marketing/feature-content.png',
    imageAlt: 'Workspace zarządzania treścią',
  },
  {
    id: 'ai-copy',
    eyebrow: 'AI generowanie treści',
    title: 'Copy w tonie marki — z AI supportem przy każdym draftcie.',
    body: 'Generuj posty, hooki i warianty kanałowe. Asystent AI pomaga iterować, dopasowywać długość i utrzymać spójny voice marki.',
    image: '/marketing/feature-ai.png',
    imageAlt: 'AI writing i support',
  },
  {
    id: 'ai-media',
    eyebrow: 'Obrazy contentowe',
    title: 'Spersonalizowane grafiki dopasowane do Twojej marki.',
    body: 'Generuj wizualia pod posty social — w stylu, kolorach i klimacie marki. Szybciej od briefu do gotowego assetu.',
    image: '/marketing/feature-media.png',
    imageAlt: 'Generowanie obrazów contentowych AI',
  },
  {
    id: 'calendar',
    eyebrow: 'Kalendarz publikacji',
    title: 'Planuj publikacje z wyprzedzeniem.',
    body: 'Układaj kolejkę postów w kalendarzu, widzisz rytm kampanii i publikujesz wtedy, kiedy trzeba — bez chaosu terminów.',
    image: '/marketing/feature-publish.png',
    imageAlt: 'Kalendarz publikacji',
  },
];

@Component({
  selector: 'app-features',
  imports: [RouterLink, ScrollRevealDirective],
  styleUrl: './features.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section id="features" class="page-section features">
      <div class="section-inner">
        <header class="section-header section-header--centered" appScrollReveal>
          <p class="section-eyebrow">Funkcje</p>
          <h2 class="section-title">Od pomysłu do publikacji — z AI w rytmie marki.</h2>
          <p class="section-lead">
            Zarządzaj treścią, generuj copy i obrazy, planuj w kalendarzu i publikuj na Facebooku,
            Instagramie oraz LinkedIn.
          </p>
        </header>

        <div class="feature-beats">
          @for (item of beats; track item.id; let i = $index; let odd = $odd) {
            <article
              class="feature-beat"
              [class.feature-beat--reverse]="odd"
              appScrollReveal
              [appScrollRevealDelay]="i * 70"
            >
              <div class="feature-beat__copy">
                <div class="feature-beat__meta">
                  <span class="feature-beat__index" aria-hidden="true">{{ pad(i + 1) }}</span>
                  <p class="feature-beat__eyebrow">{{ item.eyebrow }}</p>
                </div>
                <h3 class="feature-beat__title">{{ item.title }}</h3>
                <p class="feature-beat__body">{{ item.body }}</p>
              </div>
              <figure class="feature-beat__media">
                <span class="feature-beat__media-glow" aria-hidden="true"></span>
                <img
                  [src]="item.image"
                  [alt]="item.imageAlt"
                  width="1280"
                  height="720"
                  loading="lazy"
                  decoding="async"
                />
              </figure>
            </article>
          }
        </div>

        <div class="features-cta" appScrollReveal>
          <a routerLink="/register" class="btn btn--primary">Zacznij za darmo</a>
        </div>
      </div>
    </section>
  `,
})
export class Features {
  protected readonly beats = FEATURE_BEATS;

  protected pad(n: number): string {
    return n.toString().padStart(2, '0');
  }
}
