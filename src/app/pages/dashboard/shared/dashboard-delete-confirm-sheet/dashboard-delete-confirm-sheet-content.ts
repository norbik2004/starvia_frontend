import { Component, inject } from '@angular/core';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import type { DashboardDeleteConfirmData } from './dashboard-delete-confirm-data';

@Component({
  selector: 'app-dashboard-delete-confirm-sheet-content',
  styleUrl: './dashboard-delete-confirm-sheet-content.scss',
  template: `
    <section
      class="dashboard-delete-sheet-content"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="dashboard-delete-sheet-title"
      aria-describedby="dashboard-delete-sheet-desc"
    >
      <div class="dashboard-delete-sheet-content__lead">
        <div class="dashboard-delete-sheet-content__badge" aria-hidden="true">
          <span class="material-icons">delete</span>
        </div>

        <div class="dashboard-delete-sheet-content__copy">
          <p class="dashboard-delete-sheet-content__eyebrow">Confirm deletion</p>
          <h2 id="dashboard-delete-sheet-title" class="dashboard-delete-sheet-content__title">
            {{ data.title }}
          </h2>
          <p id="dashboard-delete-sheet-desc" class="dashboard-delete-sheet-content__desc">
            {{ data.description }}
          </p>
        </div>
      </div>

      <div class="dashboard-delete-sheet-content__actions">
        <button
          type="button"
          class="dashboard-delete-sheet-btn dashboard-delete-sheet-btn--keep"
          (click)="dismiss(false)"
        >
          <span class="material-icons" aria-hidden="true">close</span>
          {{ data.keepLabel }}
        </button>
        <button
          type="button"
          class="dashboard-delete-sheet-btn dashboard-delete-sheet-btn--delete"
          (click)="dismiss(true)"
        >
          <span class="material-icons" aria-hidden="true">delete</span>
          {{ data.deleteLabel }}
        </button>
      </div>
    </section>
  `,
})
export class DashboardDeleteConfirmSheetContent {
  protected readonly data = inject<DashboardDeleteConfirmData>(MAT_BOTTOM_SHEET_DATA);
  private readonly sheetRef = inject(MatBottomSheetRef<DashboardDeleteConfirmSheetContent, boolean>);

  protected dismiss(confirmed: boolean): void {
    this.sheetRef.dismiss(confirmed);
  }
}
