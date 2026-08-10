import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageRevealDirective } from '../../directives/page-reveal';
import { ScrollRevealDirective } from '../../directives/scroll-reveal';
import { Features } from '../../layout/features/features';
import { Footer } from '../../layout/footer/footer';
import { Header } from '../../layout/header/header';
import { Hero } from '../../layout/hero/hero';

type Topic = {
  title: string;
  body: string;
};

type Channel = {
  name: string;
  tagline: string;
  body: string;
  points: string[];
};

type WorkflowStep = {
  step: string;
  title: string;
  body: string;
  time: string;
};

type PricingPlan = {
  name: string;
  badge: string;
  price: string;
  period: string;
  note: string;
  description: string;
  ctaLabel: string;
  ctaRoute?: string | null;
  ctaHref?: string | null;
  featured: boolean;
  features: string[];
};

@Component({
  selector: 'app-home-page',
  imports: [Header, Hero, Features, Footer, PageRevealDirective, ScrollRevealDirective, RouterLink],
  styleUrl: './home.scss',
  template: `
    <div appPageReveal class="home marketing-surface">
      <app-header />
      <app-hero
        brandName="Starvia"
        eyebrow="AI social workspace"
        heading="Zarządzaj treścią. Twórz z AI. Publikuj regularnie."
        description="Planowanie, generowanie copy i obrazów marki oraz publikacja na Facebooku, Instagramie i LinkedIn — w jednym miejscu."
        primaryActionLabel="Zacznij za darmo"
        [primaryActionRoute]="'/register'"
        secondaryActionLabel="Zobacz funkcje"
        [secondaryActionHref]="'#features'"
        panelImage="/marketing/hero-workspace.png"
        panelCaption="Workspace"
      />

      <main>
        <section class="page-section topics-section" aria-labelledby="topics-title">
          <div class="section-inner topics-section__inner">
            <header class="section-header section-header--centered" appScrollReveal>
              <p class="section-eyebrow">Główne tematy</p>
              <h2 id="topics-title" class="section-title">Wszystko, czego potrzebuje content ops.</h2>
              <p class="section-lead">
                Od zarządzania postami po AI i kalendarz — Starvia spina proces, zamiast dokładać kolejne narzędzie.
              </p>
            </header>

            <ul class="topics-grid">
              @for (topic of topics; track topic.title; let i = $index) {
                <li class="topic-item" appScrollReveal [appScrollRevealDelay]="i * 80">
                  <span class="topic-item__accent" aria-hidden="true"></span>
                  <div class="topic-item__top">
                    <span class="topic-item__index" aria-hidden="true">{{ pad(i + 1) }}</span>
                    <span class="topic-item__mark" aria-hidden="true"></span>
                  </div>
                  <h3 class="topic-item__title">{{ topic.title }}</h3>
                  <p class="topic-item__body">{{ topic.body }}</p>
                </li>
              }
            </ul>
          </div>
        </section>

        <app-features />

        <section id="channels" class="page-section channels-section" aria-labelledby="channels-title">
          <div class="channels-section__glow" aria-hidden="true"></div>
          <div class="section-inner channels-section__inner">
            <header class="section-header section-header--centered channels-section__header" appScrollReveal>
              <p class="section-eyebrow">Konta social</p>
              <h2 id="channels-title" class="section-title">Trzy kanały. Jedna kolejka publikacji.</h2>
              <p class="section-lead">
                Podłącz Facebook, Instagram i LinkedIn. Drafty, kalendarz i statusy żyją w jednym workspace —
                bez skakania między aplikacjami.
              </p>
            </header>

            <div class="channels-grid">
              @for (channel of channels; track channel.name; let i = $index) {
                <article class="channel-card" appScrollReveal [appScrollRevealDelay]="i * 90">
                  <span class="channel-card__index" aria-hidden="true">{{ pad(i + 1) }}</span>
                  <p class="channel-card__name">{{ channel.name }}</p>
                  <p class="channel-card__tagline">{{ channel.tagline }}</p>
                  <p class="channel-card__body">{{ channel.body }}</p>
                  <ul class="channel-card__points">
                    @for (point of channel.points; track point) {
                      <li>{{ point }}</li>
                    }
                  </ul>
                </article>
              }
            </div>
          </div>
        </section>

        <section class="page-section workflow-section">
          <div class="section-inner workflow-section__inner">
            <header class="section-header section-header--centered" appScrollReveal>
              <p class="section-eyebrow">Workflow</p>
              <h2 class="section-title">Od briefu do live — wyraźnie szybciej niż ręcznie.</h2>
              <p class="section-lead">
                Planuj, twórz z AI, dopracuj obraz i publikuj. Ten sam proces zajmuje ułamek czasu
                w porównaniu do skakania między docsami, Canvą i panelami social.
              </p>
            </header>

            <div class="workflow-compare" appScrollReveal>
              <article class="workflow-compare__card workflow-compare__card--manual">
                <p class="workflow-compare__label">Ręcznie</p>
                <p class="workflow-compare__time">~4 h</p>
                <p class="workflow-compare__note">na tygodniowy zestaw 5–7 postów</p>
                <ul class="workflow-compare__list">
                  <li>Brief w notatkach i czacie</li>
                  <li>Copy w osobnym edytorze</li>
                  <li>Grafiki w innym toolu</li>
                  <li>Publikacja kanał po kanale</li>
                </ul>
              </article>

              <div class="workflow-compare__vs" aria-hidden="true">
                <span>vs</span>
              </div>

              <article class="workflow-compare__card workflow-compare__card--starvia">
                <p class="workflow-compare__label">Ze Starvia</p>
                <p class="workflow-compare__time">~45 min</p>
                <p class="workflow-compare__note">ten sam zakres — w jednym flow</p>
                <ul class="workflow-compare__list">
                  <li>Plan w kalendarzu</li>
                  <li>AI draft + poprawki</li>
                  <li>Obrazy w stylu marki</li>
                  <li>Jedna kolejka publikacji</li>
                </ul>
              </article>
            </div>

            <p class="workflow-compare__saving" appScrollReveal>
              To ok. <strong>6× mniej czasu</strong> na typowy tydzień contentowy — bez utraty kontroli nad tonem marki.
            </p>

            <ol class="workflow-steps">
              @for (item of workflowSteps; track item.step; let i = $index) {
                <li class="workflow-step" appScrollReveal [appScrollRevealDelay]="i * 80">
                  <span class="workflow-step__num" aria-hidden="true">{{ item.step }}</span>
                  <h3 class="workflow-step__title">{{ item.title }}</h3>
                  <p class="workflow-step__body">{{ item.body }}</p>
                  <p class="workflow-step__time">{{ item.time }}</p>
                </li>
              }
            </ol>
          </div>
        </section>

        <section id="pricing" class="page-section pricing-section">
          <div class="section-inner pricing-section__inner">
            <header class="section-header section-header--centered pricing-section__header" appScrollReveal>
              <p class="section-eyebrow">Pricing</p>
              <h2 class="section-title">Prosty cennik. Free albo Premium.</h2>
              <p class="section-lead">
                Zacznij za darmo. Przejdź na Premium, gdy chcesz pełniejszy AI, obrazy marki i mocniejszy rytm publikacji.
              </p>
            </header>

            <div class="pricing-grid">
              @for (plan of pricingPlans; track plan.name; let i = $index) {
                <article
                  class="pricing-card"
                  [class.pricing-card--featured]="plan.featured"
                  appScrollReveal
                  [appScrollRevealDelay]="i * 100"
                >
                  <div class="pricing-card__top">
                    <p class="pricing-card__badge">{{ plan.badge }}</p>
                    <h3 class="pricing-card__name">{{ plan.name }}</h3>
                    <div class="pricing-card__price-row">
                      <p class="pricing-card__price">{{ plan.price }}</p>
                      <p class="pricing-card__period">{{ plan.period }}</p>
                    </div>
                    <p class="pricing-card__note">{{ plan.note }}</p>
                    <p class="pricing-card__description">{{ plan.description }}</p>
                  </div>

                  <ul class="pricing-features">
                    @for (feature of plan.features; track feature) {
                      <li class="pricing-features__item">{{ feature }}</li>
                    }
                  </ul>

                  @if (plan.ctaRoute; as route) {
                    <a
                      [routerLink]="route"
                      class="btn"
                      [class.btn--primary]="plan.featured"
                      [class.btn--secondary]="!plan.featured"
                    >
                      {{ plan.ctaLabel }}
                    </a>
                  } @else if (plan.ctaHref; as href) {
                    <a
                      [href]="href"
                      class="btn"
                      [class.btn--primary]="plan.featured"
                      [class.btn--secondary]="!plan.featured"
                    >
                      {{ plan.ctaLabel }}
                    </a>
                  }
                </article>
              }
            </div>
          </div>
        </section>

        <section id="contact" class="page-section cta-section">
          <div class="section-inner cta-section__inner">
            <div class="cta-band" appScrollReveal>
              <p class="section-eyebrow cta-band__eyebrow">Gotowe do startu</p>
              <h2 class="cta-band__title">Twój social media workflow — wreszcie w jednym miejscu.</h2>
              <p class="cta-band__lead">
                Zostaw chaotyczne zakładki i ręczne kopiowanie. W Starvia planujesz, piszesz z AI, dopinasz grafikę marki
                i publikujesz na Facebooku, Instagramie i LinkedIn — w rytmie, który da się utrzymać.
              </p>

              <ul class="cta-band__points">
                @for (point of ctaPoints; track point; let i = $index) {
                  <li class="cta-band__point" appScrollReveal [appScrollRevealDelay]="80 + i * 70">
                    {{ point }}
                  </li>
                }
              </ul>

              <div class="cta-band__actions" appScrollReveal [appScrollRevealDelay]="280">
                <a routerLink="/register" class="btn btn--primary cta-band__primary">Zacznij za darmo</a>
                <a href="#pricing" class="btn btn--secondary cta-band__secondary">Zobacz cennik</a>
              </div>
              <p class="cta-band__assurance" appScrollReveal [appScrollRevealDelay]="340">
                Free bez karty. Konto w kilka minut. Możesz wejść w Premium, gdy rośnie tempo.
              </p>
            </div>
          </div>
        </section>
      </main>

      <app-footer />
    </div>
  `,
})
export class HomePage {
  protected readonly ctaPoints = [
    'Kalendarz i drafty zamiast rozproszonych notatek',
    'AI copy i obrazy contentowe w tonie Twojej marki',
    'Jedna kolejka publikacji na FB, IG i LinkedIn',
  ];

  protected readonly topics: Topic[] = [
    {
      title: 'Zarządzanie treścią',
      body: 'Drafty, wersje i statusy postów w jednym workspace.',
    },
    {
      title: 'AI generowanie treści',
      body: 'Posty, hooki i warianty kanałowe w tonie marki.',
    },
    {
      title: 'AI support',
      body: 'Asystent przy briefie, poprawkach i kolejnych iteracjach.',
    },
    {
      title: 'Obrazy contentowe',
      body: 'Spersonalizowane grafiki dopasowane do brandu.',
    },
    {
      title: 'Kalendarz publikacji',
      body: 'Planowanie i kolejka postów w rytmie kampanii.',
    },
    {
      title: '3 konta social',
      body: 'Facebook, Instagram i LinkedIn w jednej kolejce.',
    },
  ];

  protected readonly channels: Channel[] = [
    {
      name: 'Facebook',
      tagline: 'Fanpage i reach',
      body: 'Planuj i publikuj posty fanpage’a bez wychodzenia ze Starvia — od draftu po zaplanowany termin.',
      points: ['Harmonogram postów', 'Statusy w jednym widoku', 'Spójny voice marki'],
    },
    {
      name: 'Instagram',
      tagline: 'Feed i wizualia',
      body: 'Przygotuj copy i grafiki pod feed w stylu marki. AI pomaga dopiąć treść i klimat visuali.',
      points: ['Copy pod IG', 'Obrazy contentowe', 'Kolejka publikacji'],
    },
    {
      name: 'LinkedIn',
      tagline: 'B2B i ekspertiza',
      body: 'Buduj obecność zawodową: drafty, ton ekspercki i rytm publikacji dopasowany do kampanii.',
      points: ['Ton B2B', 'Serie treści', 'Plan tygodniowy'],
    },
  ];

  protected readonly workflowSteps: WorkflowStep[] = [
    {
      step: '01',
      title: 'Zaplanuj',
      body: 'Ułóż kalendarz treści i priorytety kampanii w jednym widoku.',
      time: '~8 min zamiast ~40 min',
    },
    {
      step: '02',
      title: 'Napisz z AI',
      body: 'Wygeneruj copy i dopracuj je z AI supportem w tonie marki.',
      time: '~12 min zamiast ~75 min',
    },
    {
      step: '03',
      title: 'Stwórz obraz',
      body: 'Dodaj spersonalizowaną grafikę contentową bez osobnego pipeline’u.',
      time: '~15 min zamiast ~90 min',
    },
    {
      step: '04',
      title: 'Opublikuj',
      body: 'Wyślij lub zaplanuj na Facebooku, IG i LinkedIn z jednej kolejki.',
      time: '~10 min zamiast ~45 min',
    },
  ];

  protected readonly pricingPlans: PricingPlan[] = [
    {
      name: 'Free',
      badge: 'Na start',
      price: '0 zł',
      period: '/ miesiąc',
      note: 'Bez karty. Na zawsze.',
      description: 'Wejdź w zarządzanie treścią, AI i kalendarz — idealne na pierwsze publikacje.',
      ctaLabel: 'Zacznij za darmo',
      ctaRoute: '/register',
      featured: false,
      features: [
        'Zarządzanie draftami i podstawowy kalendarz',
        'AI generowanie treści + AI support',
        '1 workspace i start z FB / IG / LinkedIn',
        'Podstawowa kolejka publikacji',
      ],
    },
    {
      name: 'Premium',
      badge: 'Najczęściej wybierany',
      price: '199 zł',
      period: '/ miesiąc',
      note: 'Pełny workflow dla marki i zespołu',
      description: 'Więcej mocy AI, obrazy contentowe marki i pewniejszy rytm publikacji na trzech kanałach.',
      ctaLabel: 'Wybierz Premium',
      ctaRoute: '/register',
      featured: true,
      features: [
        'Wszystko z Free',
        'Generowanie spersonalizowanych obrazów contentowych',
        'Szersza współpraca, review i kalendarz kampanii',
        'Pełniejsza kontrola publikacji na FB, IG i LinkedIn',
      ],
    },
  ];

  protected pad(n: number): string {
    return n.toString().padStart(2, '0');
  }
}
