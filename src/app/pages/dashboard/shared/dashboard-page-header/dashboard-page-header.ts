import { Component, input } from '@angular/core';

/**
 * Wspólny nagłówek paneli dashboardu (eyebrow, tytuł ze znacznikiem, intro, odręczny dopisek).
 *
 * Elementy projektowane przez `<ng-content />` (np. przycisk akcji) trafiają do prawej kolumny,
 * obok dopisku.
 */
@Component({
  selector: 'app-dashboard-page-header',
  styleUrl: './dashboard-page-header.scss',
  template: `
    <header class="page-header">
      <div class="page-header__copy">
        <p class="page-header__eyebrow">{{ eyebrow() }}</p>
        <h1 [id]="titleId()" class="page-header__title">
          {{ title() }}
          @if (titleMark(); as mark) {
            <span class="page-header__title-mark" aria-hidden="true">{{ mark }}</span>
          }
        </h1>
        @if (intro(); as text) {
          <p class="page-header__intro">{{ text }}</p>
        }
      </div>

      <div class="page-header__aside">
        @if (scribble(); as note) {
          <p class="page-header__scribble" aria-hidden="true">{{ note }}</p>
        }
        <ng-content />
      </div>
    </header>
  `,
})
export class DashboardPageHeader {
  readonly eyebrow = input.required<string>();
  readonly title = input.required<string>();
  /** Id nagłówka `h1` – używany w `aria-labelledby` sekcji strony. */
  readonly titleId = input.required<string>();
  readonly titleMark = input<string>();
  readonly intro = input<string>();
  readonly scribble = input<string>();
}
