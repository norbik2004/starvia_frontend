import { Component, input, output } from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';

@Component({
  selector: 'app-dashboard-delete-button',
  imports: [MatTooltip],
  styleUrl: './dashboard-delete-button.scss',
  template: `
    <button
      type="button"
      class="dashboard-delete-btn"
      [class.dashboard-delete-btn--active]="active()"
      [class.dashboard-delete-btn--sm]="size() === 'sm'"
      [class.dashboard-delete-btn--dark]="tone() === 'dark'"
      [disabled]="disabled()"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-expanded]="ariaExpanded()"
      [attr.aria-controls]="ariaControls()"
      [matTooltip]="tooltip() ?? ''"
      [matTooltipDisabled]="!tooltip()"
      matTooltipPosition="below"
      (click)="clicked.emit($event)"
    >
      <span class="material-icons" aria-hidden="true">delete</span>
    </button>
  `,
})
export class DashboardDeleteButton {
  readonly active = input(false);
  readonly disabled = input(false);
  readonly size = input<'md' | 'sm'>('md');
  readonly tone = input<'surface' | 'dark'>('surface');
  readonly ariaLabel = input('Delete');
  readonly ariaExpanded = input<boolean | null>(null);
  readonly ariaControls = input<string | null>(null);
  readonly tooltip = input<string | null>('Delete');

  readonly clicked = output<MouseEvent>();
}
