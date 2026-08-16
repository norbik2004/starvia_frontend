import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageRevealDirective } from '../../../directives/page-reveal';

@Component({
  selector: 'app-dashboard-overview',
  imports: [RouterLink, PageRevealDirective],
  styleUrl: './dashboard-overview.scss',
  template: `
    <section class="dashboard-overview" aria-labelledby="dashboard-overview-title" appPageReveal>
      <header class="dashboard-overview__hero">
        <div>
          <p class="dashboard-overview__eyebrow">Twój workspace</p>
          <h1 id="dashboard-overview-title" class="dashboard-overview__title">
            Dzień dobry w Starvia.
          </h1>
          <p class="dashboard-overview__lead">
            Zaplanuj treść, przygotuj media i trzymaj publikacje w jednym, spokojnym rytmie.
          </p>
        </div>
        <a
          routerLink="/dashboard/posts"
          [queryParams]="{ create: 'true' }"
          class="btn btn--primary dashboard-overview__primary"
        >
          <span class="material-icons" aria-hidden="true">add</span>
          Utwórz post
        </a>
      </header>

      <div class="dashboard-overview__quick-grid" aria-label="Szybkie działania">
        <a routerLink="/dashboard/posts" class="dashboard-overview__quick-card">
          <span class="dashboard-overview__quick-icon material-icons" aria-hidden="true">notes</span>
          <span>
            <strong>Posty</strong>
            <small>Zarządzaj draftami i kolejką publikacji</small>
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
