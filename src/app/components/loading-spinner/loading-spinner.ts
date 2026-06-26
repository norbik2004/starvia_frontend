import { Component, input } from '@angular/core';

@Component({
  selector: 'app-loading-spinner',
  styleUrl: './loading-spinner.scss',
  template: `
    <div class="loading-spinner" role="status" [attr.aria-label]="label()">
      <span class="loading-spinner__ring" aria-hidden="true"></span>
      <span class="loading-spinner__core" aria-hidden="true"></span>
    </div>
  `,
})
export class LoadingSpinner {
  readonly label = input('Loading');
}
