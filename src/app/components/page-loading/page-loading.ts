import { Component, input } from '@angular/core';
import { LoadingSpinner } from '../loading-spinner/loading-spinner';

@Component({
  selector: 'app-page-loading',
  imports: [LoadingSpinner],
  styleUrl: './page-loading.scss',
  template: `
    <div class="page-loading" role="status" aria-live="polite">
      <app-loading-spinner [label]="label() ?? 'Loading'" />
      @if (label()) {
        <p class="page-loading__label">{{ label() }}</p>
      }
    </div>
  `,
})
export class PageLoading {
  readonly label = input<string | null>(null);
}
