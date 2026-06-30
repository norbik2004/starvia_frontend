import { NgClass } from '@angular/common';
import { Component, booleanAttribute, computed, input } from '@angular/core';
import { getPlatformBrandClass } from '../../../../models/platform';

export type PlatformLogoSize = 'xs' | 'sm' | 'toolbar' | 'md' | 'lg';

@Component({
  selector: 'app-dashboard-platform-logo',
  imports: [NgClass],
  styleUrl: './dashboard-platform-logo.scss',
  template: `
    <span
      class="platform-logo"
      [ngClass]="[sizeClass(), brandClass(), compact() ? 'platform-logo--compact' : '']"
      role="img"
      [attr.aria-label]="platformType() + ' logo'"
    >
      @switch (normalizedType()) {
        @case ('linkedin') {
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              fill="currentColor"
              d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.114 20.452H3.56V9h3.554v11.452z"
            />
          </svg>
        }
        @case ('facebook') {
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              fill="currentColor"
              d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.413c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"
            />
          </svg>
        }
        @case ('instagram') {
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              fill="currentColor"
              d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2C5.6 4 4 5.6 4 7.6v8.8C4 18.4 5.6 20 7.6 20h8.8c2 0 3.6-1.6 3.6-3.6V7.6C20 5.6 18.4 4 16.4 4H7.6m9.65 1.5a1.25 1.25 0 0 1 1.25 1.25A1.25 1.25 0 0 1 17.25 8 1.25 1.25 0 0 1 16 6.75a1.25 1.25 0 0 1 1.25-1.25M12 7a5 5 0 0 1 5 5 5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z"
            />
          </svg>
        }
        @default {
          <span class="material-icons platform-logo__fallback" aria-hidden="true">hub</span>
        }
      }
    </span>
  `,
})
export class DashboardPlatformLogo {
  readonly platformType = input.required<string>();
  readonly size = input<PlatformLogoSize>('md');
  readonly compact = input(false, { transform: booleanAttribute });

  protected readonly normalizedType = computed(() => this.platformType().trim().toLowerCase());
  protected readonly brandClass = computed(() => getPlatformBrandClass(this.platformType()));
  protected readonly sizeClass = computed(() => `platform-logo--${this.size()}`);
}
