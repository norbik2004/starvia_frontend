import { AfterViewInit, Component, ElementRef, OnDestroy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageRevealDirective } from '../../directives/page-reveal';
import { Features } from '../../layout/features/features';
import { Footer } from '../../layout/footer/footer';
import { Header } from '../../layout/header/header';
import { Hero } from '../../layout/hero/hero';
import { createSectionStars } from '../../layout/shared/section-stars';
import { createSectionStarsInteraction } from '../../layout/shared/section-stars-pointer';
import { SectionStarsLayer } from '../../layout/shared/section-stars-layer';

type ProofStat = {
  value: string;
  label: string;
};

type WorkflowCard = {
  eyebrow: string;
  title: string;
  body: string;
};

type PricingPlan = {
  name: string;
  badge: string;
  price: string;
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
  imports: [
    Header,
    Hero,
    Features,
    Footer,
    PageRevealDirective,
    RouterLink,
    SectionStarsLayer,
  ],
  styleUrl: './home.scss',
  template: `
    <div appPageReveal class="home">
      <app-header />
      <app-hero
        [title]="title"
        eyebrow="Workflow AI dla zespołów contentowych"
        headingTop="Tworz content."
        headingBottom="Starvia spina reszte."
        description="Planowanie, AI writing, review i publishing w jednym miejscu. Ty tworzysz — zespol dowozi, a Starvia pilnuje rytmu."
        [kicker]="null"
        primaryActionLabel="Start Free"
        [primaryActionRoute]="'/register'"
        secondaryActionLabel="Zobacz Pricing"
        [secondaryActionHref]="'#pricing'"
      />

      <main>
        <app-features />

        <section id="proof" class="page-section proof-section">
          <div class="section-inner">
            <header class="section-header proof-section__header">
              <p class="section-eyebrow">Momentum</p>
              <h2 class="section-title">Starvia zamienia content ops w przewidywalny rytm pracy.</h2>
              <p class="section-lead">
                Mniej przepisywania briefow. Mniej skakania miedzy narzedziami. Wiecej publikacji,
                ktore wychodza na czas i trzymaja jeden standard marki.
              </p>
            </header>

            <div class="proof-grid">
              @for (item of proofStats; track item.label) {
                <article class="proof-card">
                  <p class="proof-card__value">{{ item.value }}</p>
                  <p class="proof-card__label">{{ item.label }}</p>
                </article>
              }
            </div>

            <div class="proof-story">
              <article class="proof-story__panel">
                <p class="proof-story__eyebrow">Co realnie sie zmienia</p>
                <h3 class="proof-story__title">Zespol nie tylko tworzy content szybciej. Zaczyna go dowozic przewidywalnie.</h3>
                <p class="proof-story__body">
                  Kazdy etap ma wlasne miejsce, wiec brief, wersje robocze, feedback i publikacja
                  nie rozjezdzaja sie miedzy dokumentami, czatem i roznymi aplikacjami.
                </p>
              </article>

              <ul class="proof-list">
                @for (item of proofBullets; track item) {
                  <li class="proof-list__item">{{ item }}</li>
                }
              </ul>
            </div>
          </div>
        </section>

        <section id="about" class="page-section narrative-section">
          <div class="section-inner narrative-section__inner">
            <div class="narrative-intro">
              <p class="section-eyebrow">Dlaczego Starvia</p>
              <h2 class="section-title">Nie kolejny edytor. Warstwa operacyjna dla calego procesu publikacji.</h2>
            </div>

            <div class="narrative-panels">
              <article class="narrative-panel narrative-panel--muted">
                <p class="narrative-panel__eyebrow">Przed Starvia</p>
                <h3 class="narrative-panel__title">Publikacja opiera sie na recznym spinaniu procesu.</h3>
                <ul class="narrative-list">
                  <li>Pomysly gina miedzy notatkami, chatem i dokumentami.</li>
                  <li>AI pomaga tylko fragmentarycznie, bez kontekstu kampanii i marki.</li>
                  <li>Akceptacje, poprawki i publikacja zajmuja wiecej czasu niz samo tworzenie.</li>
                </ul>
              </article>

              <article class="narrative-panel narrative-panel--accent">
                <p class="narrative-panel__eyebrow">Po wdrozeniu</p>
                <h3 class="narrative-panel__title">Zespol pracuje na jednym flow od briefu do live.</h3>
                <ul class="narrative-list">
                  <li>Plan, drafty i kolejne wersje zyja w jednym, wspolnym workspace.</li>
                  <li>AI generuje copy w rytmie Twojej marki, zamiast zaczynac od zera.</li>
                  <li>Publikacja przestaje byc finalnym stresem, a staje sie przewidywalnym etapem.</li>
                </ul>
              </article>
            </div>
          </div>
        </section>

        <section class="page-section workflow-section">
          <div class="section-inner workflow-section__inner">
            <header class="section-header section-header--centered">
              <p class="section-eyebrow">Workflow</p>
              <h2 class="section-title">Kazda sekcja procesu ma swoje miejsce. I wszystkie sa polaczone.</h2>
              <p class="section-lead">
                Starvia porzadkuje rytm pracy contentowej tak, zeby zespol szybciej przechodzil od
                pomyslu do publikacji i lepiej reagowal na to, co dziala.
              </p>
            </header>

            <div class="workflow-grid">
              @for (item of workflowCards; track item.title) {
                <article class="workflow-card">
                  <p class="workflow-card__eyebrow">{{ item.eyebrow }}</p>
                  <h3 class="workflow-card__title">{{ item.title }}</h3>
                  <p class="workflow-card__body">{{ item.body }}</p>
                </article>
              }
            </div>

            <div class="workflow-cta">
              <p class="workflow-cta__label">Chcesz zobaczyc, ktory plan pasuje do Twojego trybu pracy?</p>
              <a href="#pricing" class="workflow-cta__link">Przejdz do Pricing</a>
            </div>
          </div>
        </section>

        <section
          id="pricing"
          class="page-section pricing-section"
          (mousemove)="pricingStarsInteraction.onPointerMove($event)"
          (mouseleave)="pricingStarsInteraction.onPointerLeave()"
        >
          <app-section-stars-layer
            class="pricing-stars"
            [stars]="pricingStars"
            [nearIds]="pricingStarsInteraction.nearStarIds()"
          />

          <div class="section-inner pricing-section__inner">
            <header class="section-header section-header--centered pricing-section__header">
              <p class="section-eyebrow">Pricing</p>
              <h2 class="section-title">Zacznij za darmo. Wejdz w Premium, gdy proces robi sie zespolowy.</h2>
              <p class="section-lead">
                Model jest prosty: Free pomaga ruszyc i uporzadkowac workflow, a Premium odblokowuje
                wspolprace, wieksza skale i mocniejszy operating layer dla contentu.
              </p>
            </header>

            <div class="pricing-grid">
              @for (plan of pricingPlans; track plan.name) {
                <article class="pricing-card" [class.pricing-card--featured]="plan.featured">
                  <div class="pricing-card__top">
                    <p class="pricing-card__badge">{{ plan.badge }}</p>
                    <h3 class="pricing-card__name">{{ plan.name }}</h3>
                    <p class="pricing-card__price">{{ plan.price }}</p>
                    <p class="pricing-card__note">{{ plan.note }}</p>
                    <p class="pricing-card__description">{{ plan.description }}</p>
                  </div>

                  <ul class="pricing-features">
                    @for (feature of plan.features; track feature) {
                      <li class="pricing-features__item">{{ feature }}</li>
                    }
                  </ul>

                  @if (plan.ctaRoute; as route) {
                    <a [routerLink]="route" class="btn" [class.btn--primary]="plan.featured" [class.btn--secondary]="!plan.featured">
                      {{ plan.ctaLabel }}
                    </a>
                  } @else if (plan.ctaHref; as href) {
                    <a [href]="href" class="btn" [class.btn--primary]="plan.featured" [class.btn--secondary]="!plan.featured">
                      {{ plan.ctaLabel }}
                    </a>
                  }
                </article>
              }
            </div>

            <div class="pricing-footnote">
              <p>
                Free jest idealny na start. Premium jest dla zespolow, ktore chca wspolnego rytmu
                pracy, szybszych review loopow i lepszej kontroli nad publikacja.
              </p>
            </div>
          </div>
        </section>

        <section id="contact" class="page-section cta-section">
          <div class="section-inner cta-section__inner">
            <div class="cta-card">
              <p class="section-eyebrow">Gotowe do startu</p>
              <h2 class="section-title">Wybierz plan, uporzadkuj publishing ops i zacznij dowozic regularnie.</h2>
              <p class="section-lead">
                Zacznij od Free albo przejdz na Premium, jesli chcesz szybciej skalowac wspolprace,
                akceptacje i produkcje tresci w zespole.
              </p>
              <div class="cta-card__actions">
                <a routerLink="/register" class="btn btn--primary">Startuj z Free</a>
                <a href="#pricing" class="btn btn--secondary">Porownaj plany</a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <app-footer />
    </div>
  `,
})
export class HomePage implements AfterViewInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly title = 'Starvia';
  protected readonly pricingStars = createSectionStars({
    gridCols: 8,
    gridRows: 7,
    skipProbability: 0.84,
    extraCount: 10,
    minY: 0,
    maxY: 100,
    sizeMin: 2.2,
    sizeMax: 3.7,
  });
  protected readonly pricingStarsInteraction = createSectionStarsInteraction(this.pricingStars);
  protected readonly proofStats: ProofStat[] = [
    { value: '1 workspace', label: 'na plan, drafty, feedback i publikacje' },
    { value: 'AI with context', label: 'tworzy copy w rytmie marki, nie w oderwaniu od kampanii' },
    { value: 'Faster shipping', label: 'mniej tarcia miedzy pomyslem, akceptacja i live postem' },
  ];
  protected readonly proofBullets = [
    'Jeden widok dla planowania, copy i publikacji',
    'Mniej chaosu w review i mniej recznego przeklejania tresci',
    'Lepsza regularnosc publikacji bez dokladania kolejnych narzedzi',
  ];
  protected readonly workflowCards: WorkflowCard[] = [
    {
      eyebrow: 'Planowanie',
      title: 'Buduj kalendarz tresci bez rozjazdu miedzy zespolami.',
      body: 'Zbieraj pomysly, priorytety i kampanie w jednym widoku, zanim produkcja ruszy na dobre.',
    },
    {
      eyebrow: 'AI writing',
      title: 'Zamien brief w gotowy draft, hooki i warianty kanalowe.',
      body: 'Tworz szybciej, ale bez utraty tonu marki. Starvia pomaga iterowac, a nie tylko generowac.',
    },
    {
      eyebrow: 'Review',
      title: 'Zbieraj feedback i decyzje tam, gdzie faktycznie powstaje tresc.',
      body: 'Mniej zgadywania, ktora wersja jest finalna. Kazda poprawka ma swoje miejsce i kontekst.',
    },
    {
      eyebrow: 'Publishing',
      title: 'Publikuj w rytmie kampanii zamiast walczyc z deadlineami.',
      body: 'Planowanie i publikacja przestaja byc osobnymi swiatami, wiec zespol dowozi regularniej.',
    },
  ];
  protected readonly pricingPlans: PricingPlan[] = [
    {
      name: 'Free',
      badge: 'Dla startu',
      price: '0 zl',
      note: 'Na zawsze dla pojedynczego workflow startowego',
      description: 'Najlepszy wybor, jesli chcesz wejsc w uporzadkowany publishing flow bez ryzyka.',
      ctaLabel: 'Zacznij za darmo',
      ctaRoute: '/register',
      featured: false,
      features: [
        'Podstawowy workflow planowania i draftow',
        'AI support do pierwszych wersji tresci',
        'Jedno miejsce na publikacje i iteracje',
      ],
    },
    {
      name: 'Premium',
      badge: 'Dla zespolu',
      price: 'Custom',
      note: 'Dopasowany do skali, wspolpracy i procesu contentowego',
      description: 'Dla marek i zespolow, ktore chca przyspieszyc produkcje, review oraz publishing na wielu kanalach.',
      ctaLabel: 'Porozmawiaj o Premium',
      ctaHref: 'mailto:hello@starvia.app?subject=Starvia%20Premium',
      featured: true,
      features: [
        'Szersza wspolpraca zespolowa i szybsze review loop',
        'Mocniejszy operating layer dla kampanii i kalendarza',
        'Lepsza kontrola nad publikacja, jakoscia i rytmem pracy',
      ],
    },
  ];

  ngAfterViewInit(): void {
    const pricingSection = this.host.nativeElement.querySelector('#pricing');
    if (pricingSection instanceof HTMLElement) {
      this.pricingStarsInteraction.attach(pricingSection);
    }
  }

  ngOnDestroy(): void {
    this.pricingStarsInteraction.destroy();
  }
}
