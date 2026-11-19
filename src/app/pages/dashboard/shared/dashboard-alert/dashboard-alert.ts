import { Component, computed, input, output } from '@angular/core';

export type DashboardAlertTone = 'error' | 'success' | 'info';

const TONE_ICONS: Record<DashboardAlertTone, string> = {
  error: 'error_outline',
  success: 'check_circle',
  info: 'info',
};

/**
 * Jedyny sposób pokazywania komunikatów (błąd / sukces / informacja) w panelu.
 *
 * Gdzie go umieszczać:
 * - błąd lub wynik akcji całej strony → tuż pod `app-dashboard-page-header`, nad treścią,
 * - błąd w szufladzie lub oknie → na górze ich treści (`compact`),
 * - błąd w panelu / sekcji → na górze tego panelu (`compact`),
 * - błąd pojedynczego pola formularza → NIE tutaj, tylko `<p class="field__error">` pod polem.
 *
 * Bez `message` komponent nic nie renderuje (host jest wtedy `:empty`, więc nie zajmuje miejsca
 * w układzie) — można go wstawiać bez opakowującego `@if`.
 */
@Component({
  selector: 'app-dashboard-alert',
  styleUrl: './dashboard-alert.scss',
  host: {
    '[class.is-compact]': 'compact()',
  },
  template: `
    @if (message(); as text) {
      <div
        class="alert"
        [class.alert--error]="tone() === 'error'"
        [class.alert--success]="tone() === 'success'"
        [class.alert--info]="tone() === 'info'"
        [attr.role]="tone() === 'error' ? 'alert' : 'status'"
      >
        <span class="material-icons alert__icon" aria-hidden="true">{{ icon() }}</span>
        <p class="alert__message">{{ text }}</p>

        @if (retryable()) {
          <button type="button" class="alert__action" (click)="retry.emit()">
            <span class="material-icons" aria-hidden="true">refresh</span>
            {{ retryLabel() }}
          </button>
        }

        @if (dismissible()) {
          <button type="button" class="alert__close" aria-label="Zamknij komunikat" (click)="dismissed.emit()">
            <span class="material-icons" aria-hidden="true">close</span>
          </button>
        }
      </div>
    }
  `,
})
export class DashboardAlert {
  readonly message = input<string | null | undefined>(null);
  readonly tone = input<DashboardAlertTone>('error');
  /** Mniejszy wariant do szuflad, paneli i okien. */
  readonly compact = input(false);
  /** Pokazuje przycisk ponowienia; reaguj na zdarzenie `retry`. */
  readonly retryable = input(false);
  readonly retryLabel = input('Spróbuj ponownie');
  readonly dismissible = input(false);

  readonly retry = output<void>();
  readonly dismissed = output<void>();

  protected readonly icon = computed(() => TONE_ICONS[this.tone()]);
}
