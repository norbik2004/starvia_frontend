import { Component, computed, input, output } from '@angular/core';
import {
  paginationTokens,
  showingFrom,
  showingTo,
  type PaginationPage,
} from '../pagination';

@Component({
  selector: 'app-dashboard-pagination-panel',
  styleUrl: './dashboard-pagination-panel.scss',
  template: `
    <footer class="dashboard-pagination-panel">
      <div class="dashboard-pagination-panel__bar">
        <div class="dashboard-pagination-panel__start">
          <p class="dashboard-pagination-panel__range" aria-live="polite">
            @if (page().itemCount === 0) {
              <strong>No items</strong>
            } @else {
              <span class="dashboard-pagination-panel__range-label">Showing</span>
              <strong>{{ rangeFrom() }}–{{ rangeTo() }}</strong>
            }
          </p>

          <div class="field field--compact field--inline dashboard-pagination-panel__page-size">
            <label class="field__label" [attr.for]="pageSizeSelectId()">{{ pageSizeLabel() }}</label>
            <select
              [id]="pageSizeSelectId()"
              class="field__input field__input--select"
              [disabled]="disabled()"
              [value]="pageSize()"
              (change)="onPageSizeChange($event)"
            >
              @for (size of pageSizeOptions(); track size) {
                <option [value]="size">{{ size }}</option>
              }
            </select>
          </div>
        </div>

        @if (tokens().length > 0) {
          <nav class="dashboard-pagination-panel__pager" [attr.aria-label]="ariaLabel()">
            <button
              type="button"
              class="dashboard-pagination-panel__pager-btn"
              aria-label="Previous page"
              [disabled]="disabled() || !page().hasPreviousPage"
              (click)="previous.emit()"
            >
              <span class="material-icons" aria-hidden="true">chevron_left</span>
            </button>

            <div class="dashboard-pagination-panel__pager-pages" role="group" aria-label="Page numbers">
              @for (token of tokens(); track $index) {
                @if (token.kind === 'gap') {
                  <span class="dashboard-pagination-panel__pager-gap" aria-hidden="true">…</span>
                } @else {
                  <button
                    type="button"
                    class="dashboard-pagination-panel__pager-page"
                    [class.is-active]="token.n === page().pageIndex"
                    [attr.aria-current]="token.n === page().pageIndex ? 'page' : null"
                    [attr.aria-label]="'Page ' + token.n"
                    [disabled]="disabled() || token.n === page().pageIndex"
                    (click)="pageChange.emit(token.n)"
                  >
                    {{ token.n }}
                  </button>
                }
              }
            </div>

            <button
              type="button"
              class="dashboard-pagination-panel__pager-btn"
              aria-label="Next page"
              [disabled]="disabled() || !page().hasNextPage"
              (click)="next.emit()"
            >
              <span class="material-icons" aria-hidden="true">chevron_right</span>
            </button>
          </nav>
        }
      </div>
    </footer>
  `,
})
export class DashboardPaginationPanel {
  readonly page = input.required<PaginationPage>();
  readonly pageSize = input.required<number>();
  readonly pageSizeOptions = input.required<readonly number[]>();
  readonly disabled = input(false);
  readonly ariaLabel = input('Pagination');
  readonly pageSizeLabel = input('Rows');
  readonly pageSizeSelectId = input('page-size');

  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();
  readonly previous = output<void>();
  readonly next = output<void>();

  protected readonly tokens = computed(() =>
    paginationTokens(this.page().pageIndex, this.page().totalPages)
  );
  protected readonly rangeFrom = computed(() => showingFrom(this.page(), this.pageSize()));
  protected readonly rangeTo = computed(() => showingTo(this.page(), this.pageSize()));

  protected onPageSizeChange(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    if (!Number.isFinite(value) || value < 1) {
      return;
    }

    this.pageSizeChange.emit(value);
  }
}
