import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageRevealDirective } from '../../../directives/page-reveal';
import { DashboardPageHeader } from '../shared/dashboard-page-header/dashboard-page-header';

@Component({
  selector: 'app-dashboard-overview',
  imports: [RouterLink, PageRevealDirective, DashboardPageHeader],
  styleUrl: './dashboard-overview.scss',
  template: `
    <section class="dashboard-overview" aria-labelledby="dashboard-overview-title" appPageReveal>
      <app-dashboard-page-header
        titleId="dashboard-overview-title"
        eyebrow="Twój workspace"
        title="Przegląd"
        titleMark="dzień dobry"
        intro="Zaplanuj treść, przygotuj media i trzymaj publikacje w jednym, spokojnym rytmie."
        scribble="Spokojny rytm."
      >
        <a
          routerLink="/dashboard/posts"
          [queryParams]="{ create: 'true' }"
          class="btn btn--primary dashboard-overview__primary"
        >
          <span class="material-icons" aria-hidden="true">add</span>
          Utwórz post
        </a>
      </app-dashboard-page-header>

      <div class="dashboard-overview__quick-grid" aria-label="Szybkie działania">
        <a routerLink="/dashboard/posts" class="dashboard-overview__quick-card">
          <span class="dashboard-overview__quick-icon material-icons" aria-hidden="true">notes</span>
          <span>
            <strong>Posty</strong>
            <small>Zarządzaj draftami i kolejką publikacji</small>
          </span>
          <span class="material-icons dashboard-overview__arrow" aria-hidden="true">arrow_forward</span>
        </a>

        <a routerLink="/dashboard/calendar" class="dashboard-overview__quick-card">
          <span class="dashboard-overview__quick-icon material-icons" aria-hidden="true">calendar_month</span>
          <span>
            <strong>Kalendarz</strong>
            <small>Planuj publikacje na właściwe dni i godziny</small>
          </span>
          <span class="material-icons dashboard-overview__arrow" aria-hidden="true">arrow_forward</span>
        </a>

        <a routerLink="/dashboard/media" class="dashboard-overview__quick-card">
          <span class="dashboard-overview__quick-icon material-icons" aria-hidden="true">photo_library</span>
          <span>
            <strong>Biblioteka mediów</strong>
            <small>Przeglądaj grafiki i pliki marki</small>
          </span>
          <span class="material-icons dashboard-overview__arrow" aria-hidden="true">arrow_forward</span>
        </a>

        <a routerLink="/dashboard/social-accounts" class="dashboard-overview__quick-card">
          <span class="dashboard-overview__quick-icon material-icons" aria-hidden="true">link</span>
          <span>
            <strong>Konta social</strong>
            <small>Połącz i kontroluj kanały publikacji</small>
          </span>
          <span class="material-icons dashboard-overview__arrow" aria-hidden="true">arrow_forward</span>
        </a>

        <a routerLink="/dashboard/brand-profiles" class="dashboard-overview__quick-card">
          <span class="dashboard-overview__quick-icon material-icons" aria-hidden="true">storefront</span>
          <span>
            <strong>Profile marek</strong>
            <small>Brief, ton komunikacji i domyślne generowanie</small>
          </span>
          <span class="material-icons dashboard-overview__arrow" aria-hidden="true">arrow_forward</span>
        </a>

        <a routerLink="/dashboard/ai-chat" class="dashboard-overview__quick-card">
          <span class="dashboard-overview__quick-icon material-icons" aria-hidden="true">auto_awesome</span>
          <span>
            <strong>Czat AI</strong>
            <small>Promptuj pomysły i zbieraj wątki rozmów</small>
          </span>
          <span class="material-icons dashboard-overview__arrow" aria-hidden="true">arrow_forward</span>
        </a>
      </div>

      <section class="dashboard-overview__workflow" aria-labelledby="dashboard-workflow-title">
        <div class="dashboard-overview__workflow-copy">
          <p class="dashboard-overview__eyebrow">Prosty workflow</p>
          <h2 id="dashboard-workflow-title">Od pomysłu do publikacji.</h2>
          <p>Starvia prowadzi treść przez cztery czytelne etapy — bez przełączania między narzędziami.</p>
        </div>

        <ol class="dashboard-overview__steps">
          <li><span>01</span><strong>Zaplanuj</strong></li>
          <li><span>02</span><strong>Napisz</strong></li>
          <li><span>03</span><strong>Dodaj media</strong></li>
          <li><span>04</span><strong>Opublikuj</strong></li>
        </ol>
      </section>
    </section>
  `,
})
export class DashboardOverview {}
