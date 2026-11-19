import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { PageLoading } from '../../../components/page-loading/page-loading';
import { PageRevealDirective } from '../../../directives/page-reveal';
import { DrawerMotionDirective, drawerMotionDelay } from '../../../layout/shared/drawer-motion';
import { toApplicationError } from '../../../models/application-error';
import {
  BRAND_PROFILE_DEFAULT_PAGE_SIZE,
  BRAND_PROFILE_NAME_MAX_LENGTH,
  DEFAULT_BRAND_PLATFORMS,
  displayBrandProfileName,
  type PagedBrandProfilesResponse,
  type BrandProfileSummary,
} from '../../../models/brand-profile';
import { DisplayDatetimePipe } from '../../../pipes/display-datetime';
import { BrandProfileService } from '../../../services/brand-profile';
import { DashboardAlert } from '../shared/dashboard-alert/dashboard-alert';
import { DashboardDeleteButton } from '../shared/dashboard-delete-button/dashboard-delete-button';
import { DashboardDeleteConfirmService } from '../shared/dashboard-delete-confirm-sheet/dashboard-delete-confirm.service';
import { DashboardPageHeader } from '../shared/dashboard-page-header/dashboard-page-header';
import { DashboardPaginationPanel } from '../shared/dashboard-pagination-panel/dashboard-pagination-panel';
import { showingFrom, showingTo, toPaginationPage } from '../shared/pagination';

const PAGE_SIZE_OPTIONS = [12, 24, 48] as const;

type ListForm = FormGroup<{
  pageNumber: FormControl<number>;
  pageSize: FormControl<number>;
}>;

type CreateForm = FormGroup<{
  name: FormControl<string>;
}>;

@Component({
  selector: 'app-dashboard-brand-profiles',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    DisplayDatetimePipe,
    PageLoading,
    PageRevealDirective,
    DrawerMotionDirective,
    DashboardAlert,
    DashboardPageHeader,
    DashboardPaginationPanel,
    DashboardDeleteButton,
  ],
  styleUrl: './dashboard-brand-profiles.scss',
  template: `
    <section class="dashboard-content-page dashboard-brand-profiles" aria-labelledby="dashboard-brand-profiles-title">
      <div appPageReveal class="dashboard-brand-profiles__top">
        <app-dashboard-page-header
          titleId="dashboard-brand-profiles-title"
          eyebrow="Tożsamość marki"
          title="Profile marek"
          titleMark="głos i kontekst"
          intro="Zdefiniuj brief marki, ton komunikacji i domyślne ustawienia generowania — potem powiąż je z kontami social."
          scribble="Jedna marka. Spójny głos."
        >
          <button type="button" class="dashboard-brand-profiles__add-btn" (click)="openCreate()">
            <span class="material-icons dashboard-brand-profiles__add-icon" aria-hidden="true">add</span>
            Nowy profil
          </button>
        </app-dashboard-page-header>

        <app-dashboard-alert [message]="loadError()" [retryable]="true" (retry)="loadProfiles()" />
        <app-dashboard-alert
          [message]="actionMessage()"
          [tone]="actionError() ? 'error' : 'success'"
          [dismissible]="true"
          (dismissed)="clearActionNotice()"
        />
      </div>

      @if (isLoading() && !result()) {
        <app-page-loading label="Ładowanie profili marek…" />
      }

      @if (result(); as page) {
        <div appPageReveal>
          @if (page.items.length === 0) {
            <div class="dashboard-brand-profiles__empty">
              <span class="material-icons dashboard-brand-profiles__empty-icon" aria-hidden="true">storefront</span>
              <h2 class="dashboard-brand-profiles__empty-title">Brak profili marek</h2>
              <p class="dashboard-brand-profiles__empty-copy">
                Utwórz pierwszy profil, aby AI i publikacje znały kontekst Twojej marki.
              </p>
              <button type="button" class="btn btn--primary" (click)="openCreate()">
                <span class="material-icons" aria-hidden="true">add</span>
                Utwórz profil
              </button>
            </div>
          } @else {
            <div class="dashboard-list-board" [class.dashboard-list-board--loading]="isLoading()">
              <div class="dashboard-list-board__head">
                <p class="dashboard-list-board__summary" aria-live="polite">
                  Pokazuję
                  <strong>{{ listShowingFrom(page) }}–{{ listShowingTo(page) }}</strong>
                  @if (page.totalPages > 0) {
                    · Strona <strong>{{ page.pageIndex }}</strong> z <strong>{{ page.totalPages }}</strong>
                  }
                </p>
              </div>

              <ul class="dashboard-brand-profiles__grid" appPageReveal [appPageRevealList]="true">
                @for (profile of page.items; track profile.id) {
                  <li>
                    <article class="brand-card">
                      <a
                        class="brand-card__link"
                        [routerLink]="['/dashboard/brand-profiles', profile.id]"
                        [attr.aria-label]="'Otwórz profil ' + displayName(profile)"
                      >
                        <span class="brand-card__icon" aria-hidden="true">
                          <span class="material-icons">storefront</span>
                        </span>
                        <div class="brand-card__copy">
                          <h2 class="brand-card__title">{{ displayName(profile) }}</h2>
                          <p class="brand-card__meta">
                            <span>
                              <span class="material-icons" aria-hidden="true">link</span>
                              {{ platformCountLabel(profile.linkedUserPlatformCount) }}
                            </span>
                            @if (profile.createdAt) {
                              <span>
                                <span class="material-icons" aria-hidden="true">event</span>
                                <time [attr.datetime]="profile.createdAt">
                                  {{ profile.createdAt | displayDatetime }}
                                </time>
                              </span>
                            }
                          </p>
                        </div>
                        <span class="material-icons brand-card__chevron" aria-hidden="true">chevron_right</span>
                      </a>

                      <div class="brand-card__actions">
                        <app-dashboard-delete-button
                          size="sm"
                          tone="dark"
                          ariaLabel="Usuń profil marki"
                          tooltip="Usuń profil"
                          [active]="deleteConfirmId() === profile.id"
                          [disabled]="isBusy()"
                          [ariaExpanded]="deleteConfirmId() === profile.id"
                          ariaControls="dashboard-delete-sheet-title"
                          (clicked)="requestDelete(profile, $event)"
                        />
                      </div>
                    </article>
                  </li>
                }
              </ul>
            </div>
          }

          @if (page.items.length > 0 || page.totalPages > 1) {
            <app-dashboard-pagination-panel
              [page]="toPaginationPage(page)"
              [pageSize]="form.controls.pageSize.value"
              [pageSizeOptions]="pageSizeOptions"
              [disabled]="isLoading()"
              ariaLabel="Paginacja profili marek"
              pageSizeLabel="Wiersze"
              pageSizeSelectId="brand-profiles-page-size"
              (pageChange)="goToPage($event)"
              (pageSizeChange)="onPageSizeChange($event)"
              (previous)="goToPrevious()"
              (next)="goToNext()"
            />
          }
        </div>
      }

      <button
        type="button"
        class="brand-create-drawer__backdrop"
        appDrawerMotion="backdrop"
        [drawerMotionState]="createOpen() ? 'open' : createClosing() ? 'closing' : 'closed'"
        [attr.aria-hidden]="!createOpen()"
        aria-label="Zamknij panel nowego profilu"
        (click)="closeCreate()"
      ></button>

      <aside
        class="brand-create-drawer"
        appDrawerMotion="panel"
        [drawerMotionState]="createOpen() ? 'open' : createClosing() ? 'closing' : 'closed'"
        [attr.aria-hidden]="!createOpen()"
        role="dialog"
        aria-modal="true"
        aria-labelledby="brand-create-title"
      >
        <header class="brand-create-drawer__head">
          <div>
            <p class="brand-create-drawer__eyebrow">Nowa marka</p>
            <h2 id="brand-create-title" class="brand-create-drawer__title">Utwórz profil</h2>
          </div>
          <button
            type="button"
            class="brand-create-drawer__close"
            aria-label="Zamknij"
            [disabled]="isCreating()"
            (click)="closeCreate()"
          >
            <span class="brand-create-drawer__close-icon" aria-hidden="true"></span>
          </button>
        </header>

        <form class="brand-create-drawer__form" [formGroup]="createForm" (ngSubmit)="submitCreate()">
          <div class="brand-create-drawer__body">
            <p class="brand-create-drawer__description">
              Zacznij od nazwy. Brief, ton i powiązania z kontami uzupełnisz w następnym kroku.
            </p>

            <app-dashboard-alert [compact]="true" [message]="createError()" />

            <div class="field">
              <label class="field__label" for="brand-create-name">Nazwa profilu</label>
              <input
                #createNameInput
                id="brand-create-name"
                class="field__input"
                type="text"
                formControlName="name"
                [attr.maxlength]="nameMaxLength"
                autocomplete="organization"
                placeholder="np. Starvia — B2B"
              />
              <div class="field__meta">
                <div aria-live="polite">
                  @if (createForm.controls.name.touched && createForm.controls.name.hasError('required')) {
                    <p class="field__error" role="alert">Nazwa jest wymagana.</p>
                  }
                </div>
                <span class="field__counter">
                  {{ createForm.controls.name.value.length }}/{{ nameMaxLength }}
                </span>
              </div>
            </div>
          </div>

          <footer class="brand-create-drawer__actions">
            <button type="button" class="btn btn--secondary" [disabled]="isCreating()" (click)="closeCreate()">
              Anuluj
            </button>
            <button
              type="submit"
              class="btn btn--primary"
              [disabled]="isCreating() || createForm.invalid"
            >
              {{ isCreating() ? 'Tworzenie…' : 'Utwórz i edytuj' }}
            </button>
          </footer>
        </form>
      </aside>
    </section>
  `,
})
export class DashboardBrandProfiles {
  private readonly brandProfiles = inject(BrandProfileService);
  private readonly deleteConfirm = inject(DashboardDeleteConfirmService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly createNameInput = viewChild<ElementRef<HTMLInputElement>>('createNameInput');

  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  protected readonly nameMaxLength = BRAND_PROFILE_NAME_MAX_LENGTH;
  protected readonly toPaginationPage = toPaginationPage;

  protected readonly form: ListForm = new FormGroup({
    pageNumber: new FormControl(1, { nonNullable: true }),
    pageSize: new FormControl(BRAND_PROFILE_DEFAULT_PAGE_SIZE, { nonNullable: true }),
  });

  protected readonly createForm: CreateForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(BRAND_PROFILE_NAME_MAX_LENGTH)],
    }),
  });

  protected readonly result = signal<PagedBrandProfilesResponse | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly isBusy = signal(false);
  protected readonly isCreating = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly actionMessage = signal<string | null>(null);
  protected readonly actionError = signal(false);
  protected readonly createError = signal<string | null>(null);
  protected readonly deleteConfirmId = signal<string | null>(null);
  protected readonly createOpen = signal(false);
  protected readonly createClosing = signal(false);

  private createCloseTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.loadProfiles());
    this.loadProfiles();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.createOpen()) {
      this.closeCreate();
    }
  }

  protected displayName(profile: BrandProfileSummary): string {
    return displayBrandProfileName(profile.name);
  }

  protected platformCountLabel(count: number): string {
    if (count === 1) {
      return '1 konto';
    }

    const lastDigit = count % 10;
    const lastTwo = count % 100;
    if (lastDigit >= 2 && lastDigit <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) {
      return `${count} konta`;
    }

    return `${count} kont`;
  }

  protected listShowingFrom(page: PagedBrandProfilesResponse): number {
    return showingFrom(toPaginationPage(page), this.form.controls.pageSize.value);
  }

  protected listShowingTo(page: PagedBrandProfilesResponse): number {
    return showingTo(toPaginationPage(page), this.form.controls.pageSize.value);
  }

  protected loadProfiles(): void {
    this.isLoading.set(true);
    this.loadError.set(null);

    this.brandProfiles
      .browse(this.form.controls.pageNumber.value, this.form.controls.pageSize.value)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (page) => {
          if (page.totalPages > 0 && page.pageIndex > page.totalPages) {
            this.form.controls.pageNumber.setValue(page.totalPages, { emitEvent: false });
            this.loadProfiles();
            return;
          }

          this.result.set(page);
        },
        error: (error: unknown) => {
          this.loadError.set(toApplicationError(error).description);
          if (!this.result()) {
            this.result.set(null);
          }
        },
      });
  }

  protected goToPage(page: number): void {
    this.form.controls.pageNumber.setValue(page);
  }

  protected goToPrevious(): void {
    const current = this.form.controls.pageNumber.value;
    if (current > 1) {
      this.form.controls.pageNumber.setValue(current - 1);
    }
  }

  protected goToNext(): void {
    const page = this.result();
    if (page?.hasNextPage) {
      this.form.controls.pageNumber.setValue(page.pageIndex + 1);
    }
  }

  protected onPageSizeChange(size: number): void {
    this.form.patchValue({ pageSize: size, pageNumber: 1 });
  }

  protected openCreate(): void {
    this.clearCreateCloseTimer();
    this.createClosing.set(false);
    this.createError.set(null);
    this.createForm.reset({ name: '' });
    this.createOpen.set(true);
    queueMicrotask(() => this.createNameInput()?.nativeElement.focus());
  }

  protected closeCreate(): void {
    if (!this.createOpen() || this.isCreating()) {
      return;
    }

    this.createOpen.set(false);
    this.createClosing.set(true);
    this.createCloseTimer = setTimeout(() => {
      this.createClosing.set(false);
      this.createCloseTimer = null;
    }, drawerMotionDelay());
  }

  protected submitCreate(): void {
    this.createForm.markAllAsTouched();
    if (this.createForm.invalid || this.isCreating()) {
      return;
    }

    const name = this.createForm.controls.name.value.trim();
    this.isCreating.set(true);
    this.createError.set(null);

    this.brandProfiles
      .create({ name, platforms: [...DEFAULT_BRAND_PLATFORMS] })
      .pipe(finalize(() => this.isCreating.set(false)))
      .subscribe({
        next: (id) => {
          this.createOpen.set(false);
          void this.router.navigate(['/dashboard/brand-profiles', id]);
        },
        error: (error: unknown) => {
          this.createError.set(toApplicationError(error).description);
        },
      });
  }

  protected requestDelete(profile: BrandProfileSummary, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    if (this.isBusy()) {
      return;
    }

    this.deleteConfirmId.set(profile.id);
    this.deleteConfirm
      .open({
        title: 'Usunąć profil marki?',
        description: `Profil „${this.displayName(profile)}” zostanie trwale usunięty.`,
        keepLabel: 'Zostaw',
        deleteLabel: 'Usuń',
        deletingLabel: 'Usuwanie…',
      })
      .subscribe((confirmed) => {
        this.deleteConfirmId.set(null);
        if (!confirmed) {
          return;
        }

        this.isBusy.set(true);
        this.clearActionNotice();

        this.brandProfiles
          .delete(profile.id)
          .pipe(finalize(() => this.isBusy.set(false)))
          .subscribe({
            next: () => {
              this.actionError.set(false);
              this.actionMessage.set(`Usunięto profil „${this.displayName(profile)}”.`);
              this.loadProfiles();
            },
            error: (error: unknown) => {
              this.actionError.set(true);
              this.actionMessage.set(toApplicationError(error).description);
            },
          });
      });
  }

  protected clearActionNotice(): void {
    this.actionMessage.set(null);
    this.actionError.set(false);
  }

  private clearCreateCloseTimer(): void {
    if (this.createCloseTimer === null) {
      return;
    }

    clearTimeout(this.createCloseTimer);
    this.createCloseTimer = null;
  }
}
