import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { AutoExpandTextarea } from '../../../components/auto-expand-textarea/auto-expand-textarea';
import { PageLoading } from '../../../components/page-loading/page-loading';
import { PageRevealDirective } from '../../../directives/page-reveal';
import { toApplicationError } from '../../../models/application-error';
import {
  BRAND_PROFILE_NAME_MAX_LENGTH,
  BRAND_PROFILE_SHORT_TEXT_MAX_LENGTH,
  BRAND_PROFILE_TEXT_MAX_LENGTH,
  DEFAULT_BRAND_PLATFORMS,
  displayBrandProfileName,
  emptyBrandBrief,
  emptyBrandGenerationDefaults,
  normalizeBrandBrief,
  normalizeBrandGenerationDefaults,
  type BrandProfile,
  type BrandProfilePlatformOption,
  type BrandProfileUserPlatformLink,
} from '../../../models/brand-profile';
import { BrandProfileService } from '../../../services/brand-profile';
import { DashboardAlert } from '../shared/dashboard-alert/dashboard-alert';
import { DashboardDeleteButton } from '../shared/dashboard-delete-button/dashboard-delete-button';
import { DashboardDeleteConfirmService } from '../shared/dashboard-delete-confirm-sheet/dashboard-delete-confirm.service';
import { DashboardPlatformLogo } from '../shared/dashboard-platform-logo/dashboard-platform-logo';

type OfferingGroup = FormGroup<{
  name: FormControl<string>;
  description: FormControl<string>;
}>;

type ProfileForm = FormGroup<{
  name: FormControl<string>;
  companyName: FormControl<string>;
  companyIndustry: FormControl<string>;
  companyDescription: FormControl<string>;
  offerings: FormArray<OfferingGroup>;
  audienceType: FormControl<string>;
  painPoints: FormArray<FormControl<string>>;
  toneOfVoice: FormControl<string>;
  style: FormControl<string>;
  wordsToAvoid: FormArray<FormControl<string>>;
  marketingGoals: FormArray<FormControl<string>>;
  defaultPlatform: FormControl<string>;
  defaultPostType: FormControl<string>;
  defaultGoal: FormControl<string>;
  defaultLanguage: FormControl<string>;
}>;

@Component({
  selector: 'app-dashboard-brand-profile-detail',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    PageLoading,
    PageRevealDirective,
    AutoExpandTextarea,
    DashboardAlert,
    DashboardDeleteButton,
    DashboardPlatformLogo,
  ],
  styleUrl: './dashboard-brand-profile-detail.scss',
  template: `
    <section
      class="dashboard-content-page dashboard-brand-profile-detail"
      aria-labelledby="brand-profile-detail-title"
    >
      <header class="dashboard-brand-profile-detail__header" appPageReveal>
        <a routerLink="/dashboard/brand-profiles" class="section-eyebrow dashboard-brand-profile-detail__back">
          <span class="material-icons" aria-hidden="true">arrow_back</span>
          Wróć do profili marek
        </a>
        <span class="dashboard-brand-profile-detail__header-note" aria-hidden="true">Dopracuj głos marki.</span>
      </header>

      @if (isLoading()) {
        <app-page-loading label="Ładowanie profilu marki…" />
      }

      <app-dashboard-alert [message]="loadError()" [retryable]="true" (retry)="reload()" />

      @if (profile(); as item) {
        <div class="dashboard-brand-profile-detail__body" appPageReveal>
          <section class="brand-detail-hero" aria-labelledby="brand-profile-detail-title">
            <div class="brand-detail-hero__icon" aria-hidden="true">
              <span class="material-icons">storefront</span>
            </div>
            <div class="brand-detail-hero__copy">
              <p class="brand-detail-hero__eyebrow">Profil marki</p>
              <h1 id="brand-profile-detail-title" class="brand-detail-hero__title">
                {{ displayName(item) }}
              </h1>
              <p class="brand-detail-hero__hint">
                Brief, ton komunikacji i konta social używane przy generowaniu treści.
              </p>
            </div>
            <app-dashboard-delete-button
              size="md"
              tone="dark"
              ariaLabel="Usuń profil marki"
              tooltip="Usuń profil"
              [active]="deleteConfirmOpen()"
              [disabled]="isBusy()"
              [ariaExpanded]="deleteConfirmOpen()"
              ariaControls="dashboard-delete-sheet-title"
              (clicked)="requestDelete()"
            />
          </section>

          <app-dashboard-alert
            [tone]="noticeTone()"
            [message]="notice()"
            [dismissible]="true"
            (dismissed)="notice.set(null)"
          />

          <form class="brand-detail-form" [formGroup]="form" (ngSubmit)="saveProfile()">
            <article class="account-panel" aria-labelledby="brand-basics-title">
              <div class="account-panel__head">
                <span class="account-panel__icon" aria-hidden="true">
                  <span class="material-icons">badge</span>
                </span>
                <div class="account-panel__head-copy">
                  <h2 id="brand-basics-title" class="account-panel__title">Podstawy</h2>
                  <p class="account-panel__copy">Nazwa profilu widoczna na liście i w generatorach.</p>
                </div>
              </div>

              <div class="field">
                <label class="field__label" for="brand-name">Nazwa profilu</label>
                <input
                  id="brand-name"
                  class="field__input"
                  type="text"
                  formControlName="name"
                  [attr.maxlength]="nameMaxLength"
                  autocomplete="organization"
                />
                <p class="field__counter">{{ form.controls.name.value.length }}/{{ nameMaxLength }}</p>
              </div>
            </article>

            <article class="account-panel" aria-labelledby="brand-company-title">
              <div class="account-panel__head">
                <span class="account-panel__icon" aria-hidden="true">
                  <span class="material-icons">apartment</span>
                </span>
                <div class="account-panel__head-copy">
                  <h2 id="brand-company-title" class="account-panel__title">Firma</h2>
                  <p class="account-panel__copy">Kim jesteście i w jakiej branży działacie.</p>
                </div>
              </div>

              <div class="brand-detail-form__grid">
                <div class="field">
                  <label class="field__label" for="brand-company-name">Nazwa firmy</label>
                  <input id="brand-company-name" class="field__input" type="text" formControlName="companyName" [attr.maxlength]="shortMaxLength" />
                </div>
                <div class="field">
                  <label class="field__label" for="brand-company-industry">Branża</label>
                  <input id="brand-company-industry" class="field__input" type="text" formControlName="companyIndustry" [attr.maxlength]="shortMaxLength" />
                </div>
              </div>

              <div class="field">
                <label class="field__label" for="brand-company-description">Opis</label>
                <app-auto-expand-textarea
                  id="brand-company-description"
                  variant="field"
                  formControlName="companyDescription"
                  [maxLength]="textMaxLength"
                  ariaLabel="Opis firmy"
                  placeholder="Krótko: misja, oferta, wyróżniki…"
                />
              </div>
            </article>

            <article class="account-panel" aria-labelledby="brand-offerings-title">
              <div class="account-panel__head">
                <span class="account-panel__icon" aria-hidden="true">
                  <span class="material-icons">inventory_2</span>
                </span>
                <div class="account-panel__head-copy">
                  <h2 id="brand-offerings-title" class="account-panel__title">Oferta</h2>
                  <p class="account-panel__copy">Produkty lub usługi, o których ma mówić treść.</p>
                </div>
              </div>

              <div class="brand-detail-list" formArrayName="offerings">
                @for (offering of offerings.controls; track $index; let index = $index) {
                  <div class="brand-detail-list__item" [formGroupName]="index">
                    <div class="brand-detail-list__item-head">
                      <p class="brand-detail-list__item-label">Pozycja {{ index + 1 }}</p>
                      <button
                        type="button"
                        class="brand-detail-list__remove"
                        aria-label="Usuń pozycję oferty"
                        (click)="removeOffering(index)"
                      >
                        <span class="material-icons" aria-hidden="true">close</span>
                      </button>
                    </div>
                    <div class="field">
                      <label class="field__label" [attr.for]="'offering-name-' + index">Nazwa</label>
                      <input
                        class="field__input"
                        type="text"
                        formControlName="name"
                        [id]="'offering-name-' + index"
                        [attr.maxlength]="shortMaxLength"
                      />
                    </div>
                    <div class="field">
                      <label class="field__label" [attr.for]="'offering-desc-' + index">Opis</label>
                      <app-auto-expand-textarea
                        [id]="'offering-desc-' + index"
                        variant="field"
                        formControlName="description"
                        [maxLength]="textMaxLength"
                        [ariaLabel]="'Opis oferty ' + (index + 1)"
                      />
                    </div>
                  </div>
                }
              </div>

              <button type="button" class="btn btn--secondary btn--compact" (click)="addOffering()">
                <span class="material-icons" aria-hidden="true">add</span>
                Dodaj ofertę
              </button>
            </article>

            <article class="account-panel" aria-labelledby="brand-audience-title">
              <div class="account-panel__head">
                <span class="account-panel__icon" aria-hidden="true">
                  <span class="material-icons">groups</span>
                </span>
                <div class="account-panel__head-copy">
                  <h2 id="brand-audience-title" class="account-panel__title">Odbiorcy</h2>
                  <p class="account-panel__copy">Do kogo mówicie i jakie bolączki adresujecie.</p>
                </div>
              </div>

              <div class="field">
                <label class="field__label" for="brand-audience-type">Typ odbiorcy</label>
                <input
                  id="brand-audience-type"
                  class="field__input"
                  type="text"
                  formControlName="audienceType"
                  [attr.maxlength]="shortMaxLength"
                  placeholder="np. właściciele MŚP, marketerzy B2B"
                />
              </div>

              <div class="brand-chip-editor">
                <p class="field__label">Bolączki</p>
                <div class="brand-chip-editor__list" formArrayName="painPoints">
                  @for (control of painPoints.controls; track $index; let index = $index) {
                    <div class="brand-chip-editor__row">
                      <input class="field__input" type="text" [formControl]="control" [attr.maxlength]="shortMaxLength" [attr.aria-label]="'Bolączka ' + (index + 1)" />
                      <button type="button" class="brand-chip-editor__remove" aria-label="Usuń bolączkę" (click)="removePainPoint(index)">
                        <span class="material-icons" aria-hidden="true">close</span>
                      </button>
                    </div>
                  }
                </div>
                <button type="button" class="btn btn--secondary btn--compact" (click)="addPainPoint()">
                  <span class="material-icons" aria-hidden="true">add</span>
                  Dodaj bolączkę
                </button>
              </div>
            </article>

            <article class="account-panel" aria-labelledby="brand-identity-title">
              <div class="account-panel__head">
                <span class="account-panel__icon" aria-hidden="true">
                  <span class="material-icons">record_voice_over</span>
                </span>
                <div class="account-panel__head-copy">
                  <h2 id="brand-identity-title" class="account-panel__title">Tożsamość</h2>
                  <p class="account-panel__copy">Ton, styl i słowa, których unikać.</p>
                </div>
              </div>

              <div class="brand-detail-form__grid">
                <div class="field">
                  <label class="field__label" for="brand-tone">Ton głosu</label>
                  <input id="brand-tone" class="field__input" type="text" formControlName="toneOfVoice" [attr.maxlength]="shortMaxLength" placeholder="np. spokojny, ekspercki" />
                </div>
                <div class="field">
                  <label class="field__label" for="brand-style">Styl</label>
                  <input id="brand-style" class="field__input" type="text" formControlName="style" [attr.maxlength]="shortMaxLength" placeholder="np. zwięzły, bez żargonu" />
                </div>
              </div>

              <div class="brand-chip-editor">
                <p class="field__label">Słowa do unikania</p>
                <div class="brand-chip-editor__list" formArrayName="wordsToAvoid">
                  @for (control of wordsToAvoid.controls; track $index; let index = $index) {
                    <div class="brand-chip-editor__row">
                      <input class="field__input" type="text" [formControl]="control" [attr.maxlength]="shortMaxLength" [attr.aria-label]="'Słowo ' + (index + 1)" />
                      <button type="button" class="brand-chip-editor__remove" aria-label="Usuń słowo" (click)="removeWordToAvoid(index)">
                        <span class="material-icons" aria-hidden="true">close</span>
                      </button>
                    </div>
                  }
                </div>
                <button type="button" class="btn btn--secondary btn--compact" (click)="addWordToAvoid()">
                  <span class="material-icons" aria-hidden="true">add</span>
                  Dodaj słowo
                </button>
              </div>
            </article>

            <article class="account-panel" aria-labelledby="brand-goals-title">
              <div class="account-panel__head">
                <span class="account-panel__icon" aria-hidden="true">
                  <span class="material-icons">flag</span>
                </span>
                <div class="account-panel__head-copy">
                  <h2 id="brand-goals-title" class="account-panel__title">Cele marketingowe</h2>
                  <p class="account-panel__copy">Po co publikujecie — świadomość, leady, edukacja…</p>
                </div>
              </div>

              <div class="brand-chip-editor">
                <div class="brand-chip-editor__list" formArrayName="marketingGoals">
                  @for (control of marketingGoals.controls; track $index; let index = $index) {
                    <div class="brand-chip-editor__row">
                      <input class="field__input" type="text" [formControl]="control" [attr.maxlength]="shortMaxLength" [attr.aria-label]="'Cel ' + (index + 1)" />
                      <button type="button" class="brand-chip-editor__remove" aria-label="Usuń cel" (click)="removeMarketingGoal(index)">
                        <span class="material-icons" aria-hidden="true">close</span>
                      </button>
                    </div>
                  }
                </div>
                <button type="button" class="btn btn--secondary btn--compact" (click)="addMarketingGoal()">
                  <span class="material-icons" aria-hidden="true">add</span>
                  Dodaj cel
                </button>
              </div>
            </article>

            <article class="account-panel" aria-labelledby="brand-defaults-title">
              <div class="account-panel__head">
                <span class="account-panel__icon" aria-hidden="true">
                  <span class="material-icons">tune</span>
                </span>
                <div class="account-panel__head-copy">
                  <h2 id="brand-defaults-title" class="account-panel__title">Domyślne generowanie</h2>
                  <p class="account-panel__copy">Wskazówki startowe dla AI przy tworzeniu postów.</p>
                </div>
              </div>

              <div class="brand-detail-form__grid">
                <div class="field">
                  <label class="field__label" for="brand-default-platform">Platforma</label>
                  <input id="brand-default-platform" class="field__input" type="text" formControlName="defaultPlatform" [attr.maxlength]="shortMaxLength" placeholder="np. LinkedIn" />
                </div>
                <div class="field">
                  <label class="field__label" for="brand-default-post-type">Typ posta</label>
                  <input id="brand-default-post-type" class="field__input" type="text" formControlName="defaultPostType" [attr.maxlength]="shortMaxLength" placeholder="np. thought leadership" />
                </div>
                <div class="field">
                  <label class="field__label" for="brand-default-goal">Cel</label>
                  <input id="brand-default-goal" class="field__input" type="text" formControlName="defaultGoal" [attr.maxlength]="shortMaxLength" />
                </div>
                <div class="field">
                  <label class="field__label" for="brand-default-language">Język</label>
                  <input id="brand-default-language" class="field__input" type="text" formControlName="defaultLanguage" [attr.maxlength]="shortMaxLength" placeholder="np. pl, en" />
                </div>
              </div>
            </article>

            <div class="brand-detail-form__save">
              <button type="submit" class="btn btn--primary" [disabled]="isSavingProfile() || form.invalid">
                {{ isSavingProfile() ? 'Zapisywanie…' : 'Zapisz profil' }}
              </button>
            </div>
          </form>

          <article class="account-panel account-panel--social" aria-labelledby="brand-platforms-title">
            <div class="account-panel__head">
              <span class="account-panel__icon" aria-hidden="true">
                <span class="material-icons">hub</span>
              </span>
              <div class="account-panel__head-copy">
                <h2 id="brand-platforms-title" class="account-panel__title">Powiązane konta</h2>
                <p class="account-panel__copy">
                  Wybierz konta social dla tego profilu. Jedno z nich może być domyślne.
                </p>
              </div>
            </div>

            @if (platformsLoading()) {
              <p class="brand-platforms__status">Ładowanie kont…</p>
            } @else if (platformOptions().length === 0) {
              <p class="brand-platforms__status">
                Brak połączonych kont.
                <a routerLink="/dashboard/social-accounts">Połącz platformę</a>
                , a potem wróć tutaj.
              </p>
            } @else {
              <ul class="brand-platforms__list">
                @for (option of platformOptions(); track option.id) {
                  <li class="brand-platforms__item">
                    <label class="brand-platforms__check">
                      <input
                        type="checkbox"
                        [checked]="isPlatformSelected(option.id)"
                        (change)="togglePlatform(option.id, $event)"
                      />
                      <app-dashboard-platform-logo
                        [platformType]="option.platformType ?? option.platformLabel"
                        size="sm"
                      />
                      <span class="brand-platforms__identity">
                        <strong>{{ option.platformLabel }}</strong>
                        <small>{{ option.accountUsername }}</small>
                      </span>
                    </label>

                    @if (isPlatformSelected(option.id)) {
                      <label class="brand-platforms__default">
                        <input
                          type="radio"
                          name="brand-default-platform"
                          [checked]="selectedDefaultId() === option.id"
                          (change)="setDefaultPlatform(option.id)"
                        />
                        Domyślne
                      </label>
                    }
                  </li>
                }
              </ul>

              <div class="brand-detail-form__save">
                <button
                  type="button"
                  class="btn btn--primary"
                  [disabled]="isSavingPlatforms() || !platformsDirty()"
                  (click)="savePlatforms()"
                >
                  {{ isSavingPlatforms() ? 'Zapisywanie…' : 'Zapisz powiązania' }}
                </button>
              </div>
            }
          </article>
        </div>
      }
    </section>
  `,
})
export class DashboardBrandProfileDetail {
  private readonly brandProfiles = inject(BrandProfileService);
  private readonly deleteConfirm = inject(DashboardDeleteConfirmService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly nameMaxLength = BRAND_PROFILE_NAME_MAX_LENGTH;
  protected readonly shortMaxLength = BRAND_PROFILE_SHORT_TEXT_MAX_LENGTH;
  protected readonly textMaxLength = BRAND_PROFILE_TEXT_MAX_LENGTH;

  protected readonly form: ProfileForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(BRAND_PROFILE_NAME_MAX_LENGTH)],
    }),
    companyName: new FormControl('', { nonNullable: true }),
    companyIndustry: new FormControl('', { nonNullable: true }),
    companyDescription: new FormControl('', { nonNullable: true }),
    offerings: new FormArray<OfferingGroup>([]),
    audienceType: new FormControl('', { nonNullable: true }),
    painPoints: new FormArray<FormControl<string>>([]),
    toneOfVoice: new FormControl('', { nonNullable: true }),
    style: new FormControl('', { nonNullable: true }),
    wordsToAvoid: new FormArray<FormControl<string>>([]),
    marketingGoals: new FormArray<FormControl<string>>([]),
    defaultPlatform: new FormControl('', { nonNullable: true }),
    defaultPostType: new FormControl('', { nonNullable: true }),
    defaultGoal: new FormControl('', { nonNullable: true }),
    defaultLanguage: new FormControl('', { nonNullable: true }),
  });

  protected readonly profile = signal<BrandProfile | null>(null);
  protected readonly platformOptions = signal<BrandProfilePlatformOption[]>([]);
  protected readonly selectedPlatformIds = signal<ReadonlySet<string>>(new Set());
  protected readonly selectedDefaultId = signal<string | null>(null);
  protected readonly platformsDirty = signal(false);

  protected readonly isLoading = signal(false);
  protected readonly platformsLoading = signal(false);
  protected readonly isSavingProfile = signal(false);
  protected readonly isSavingPlatforms = signal(false);
  protected readonly isBusy = signal(false);
  protected readonly deleteConfirmOpen = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly noticeTone = signal<'success' | 'error'>('success');

  private profileId: string | null = null;
  private savedPlatformSnapshot = '';

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id');
      this.profileId = id;
      if (id) {
        this.load(id);
      }
    });
  }

  protected get offerings(): FormArray<OfferingGroup> {
    return this.form.controls.offerings;
  }

  protected get painPoints(): FormArray<FormControl<string>> {
    return this.form.controls.painPoints;
  }

  protected get wordsToAvoid(): FormArray<FormControl<string>> {
    return this.form.controls.wordsToAvoid;
  }

  protected get marketingGoals(): FormArray<FormControl<string>> {
    return this.form.controls.marketingGoals;
  }

  protected displayName(profile: BrandProfile): string {
    return displayBrandProfileName(profile.name);
  }

  protected reload(): void {
    if (this.profileId) {
      this.load(this.profileId);
    }
  }

  protected addOffering(name = '', description = ''): void {
    this.offerings.push(this.createOfferingGroup(name, description));
  }

  protected removeOffering(index: number): void {
    this.offerings.removeAt(index);
  }

  protected addPainPoint(value = ''): void {
    this.painPoints.push(new FormControl(value, { nonNullable: true }));
  }

  protected removePainPoint(index: number): void {
    this.painPoints.removeAt(index);
  }

  protected addWordToAvoid(value = ''): void {
    this.wordsToAvoid.push(new FormControl(value, { nonNullable: true }));
  }

  protected removeWordToAvoid(index: number): void {
    this.wordsToAvoid.removeAt(index);
  }

  protected addMarketingGoal(value = ''): void {
    this.marketingGoals.push(new FormControl(value, { nonNullable: true }));
  }

  protected removeMarketingGoal(index: number): void {
    this.marketingGoals.removeAt(index);
  }

  protected isPlatformSelected(id: string): boolean {
    return this.selectedPlatformIds().has(id);
  }

  protected togglePlatform(id: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const next = new Set(this.selectedPlatformIds());

    if (checked) {
      next.add(id);
      if (!this.selectedDefaultId()) {
        this.selectedDefaultId.set(id);
      }
    } else {
      next.delete(id);
      if (this.selectedDefaultId() === id) {
        this.selectedDefaultId.set(next.values().next().value ?? null);
      }
    }

    this.selectedPlatformIds.set(next);
    this.markPlatformsDirty();
  }

  protected setDefaultPlatform(id: string): void {
    if (!this.selectedPlatformIds().has(id)) {
      return;
    }

    this.selectedDefaultId.set(id);
    this.markPlatformsDirty();
  }

  protected saveProfile(): void {
    const id = this.profileId;
    if (!id || this.form.invalid || this.isSavingProfile()) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const briefSource = emptyBrandBrief();
    briefSource.company = {
      name: value.companyName,
      industry: value.companyIndustry,
      description: value.companyDescription,
    };
    briefSource.offerings = value.offerings.map((offering) => ({
      name: offering.name,
      description: offering.description,
    }));
    briefSource.targetAudience = {
      type: value.audienceType,
      painPoints: value.painPoints,
    };
    briefSource.brandIdentity = {
      toneOfVoice: value.toneOfVoice,
      style: value.style,
      wordsToAvoid: value.wordsToAvoid,
    };
    briefSource.marketingGoals = value.marketingGoals;

    const defaultsSource = emptyBrandGenerationDefaults();
    defaultsSource.platform = value.defaultPlatform;
    defaultsSource.postType = value.defaultPostType;
    defaultsSource.goal = value.defaultGoal;
    defaultsSource.language = value.defaultLanguage;

    this.isSavingProfile.set(true);
    this.notice.set(null);

    const current = this.profile();
    const platforms =
      current?.platforms && current.platforms.length > 0
        ? current.platforms
        : [...DEFAULT_BRAND_PLATFORMS];

    this.brandProfiles
      .update(id, {
        name: value.name.trim() || null,
        brief: normalizeBrandBrief(briefSource),
        platforms,
        generationDefaults: normalizeBrandGenerationDefaults(defaultsSource),
      })
      .pipe(finalize(() => this.isSavingProfile.set(false)))
      .subscribe({
        next: () => {
          this.noticeTone.set('success');
          this.notice.set('Zapisano profil marki.');
          this.reload();
        },
        error: (error: unknown) => {
          this.noticeTone.set('error');
          this.notice.set(toApplicationError(error).description);
        },
      });
  }

  protected savePlatforms(): void {
    const id = this.profileId;
    if (!id || this.isSavingPlatforms()) {
      return;
    }

    const links = this.buildPlatformLinks();
    this.isSavingPlatforms.set(true);
    this.notice.set(null);

    this.brandProfiles
      .setUserPlatforms(id, links)
      .pipe(finalize(() => this.isSavingPlatforms.set(false)))
      .subscribe({
        next: () => {
          this.noticeTone.set('success');
          this.notice.set('Zapisano powiązane konta.');
          this.savedPlatformSnapshot = this.snapshotPlatforms(links);
          this.platformsDirty.set(false);
          this.reload();
        },
        error: (error: unknown) => {
          this.noticeTone.set('error');
          this.notice.set(toApplicationError(error).description);
        },
      });
  }

  protected requestDelete(): void {
    const item = this.profile();
    if (!item || this.isBusy()) {
      return;
    }

    this.deleteConfirmOpen.set(true);
    this.deleteConfirm
      .open({
        title: 'Usunąć profil marki?',
        description: `Profil „${this.displayName(item)}” zostanie trwale usunięty.`,
        keepLabel: 'Zostaw',
        deleteLabel: 'Usuń',
        deletingLabel: 'Usuwanie…',
      })
      .subscribe((confirmed) => {
        this.deleteConfirmOpen.set(false);
        if (!confirmed) {
          return;
        }

        this.isBusy.set(true);
        this.brandProfiles
          .delete(item.id)
          .pipe(finalize(() => this.isBusy.set(false)))
          .subscribe({
            next: () => {
              void this.router.navigateByUrl('/dashboard/brand-profiles');
            },
            error: (error: unknown) => {
              this.noticeTone.set('error');
              this.notice.set(toApplicationError(error).description);
            },
          });
      });
  }

  private load(id: string): void {
    this.isLoading.set(true);
    this.platformsLoading.set(true);
    this.loadError.set(null);

    forkJoin({
      profile: this.brandProfiles.getById(id),
      platforms: this.brandProfiles.listPlatformOptions(),
    })
      .pipe(
        finalize(() => {
          this.isLoading.set(false);
          this.platformsLoading.set(false);
        }),
      )
      .subscribe({
        next: ({ profile, platforms }) => {
          this.profile.set(profile);
          this.platformOptions.set(platforms);
          this.patchForm(profile);
          this.patchPlatforms(profile.userPlatforms);
        },
        error: (error: unknown) => {
          this.profile.set(null);
          this.loadError.set(toApplicationError(error).description);
        },
      });
  }

  private patchForm(profile: BrandProfile): void {
    const brief = profile.brief ?? emptyBrandBrief();
    const defaults = profile.generationDefaults ?? emptyBrandGenerationDefaults();

    this.form.patchValue({
      name: profile.name ?? '',
      companyName: brief.company?.name ?? '',
      companyIndustry: brief.company?.industry ?? '',
      companyDescription: brief.company?.description ?? '',
      audienceType: brief.targetAudience?.type ?? '',
      toneOfVoice: brief.brandIdentity?.toneOfVoice ?? '',
      style: brief.brandIdentity?.style ?? '',
      defaultPlatform: defaults.platform ?? '',
      defaultPostType: defaults.postType ?? '',
      defaultGoal: defaults.goal ?? '',
      defaultLanguage: defaults.language ?? '',
    });

    this.offerings.clear();
    this.painPoints.clear();
    this.wordsToAvoid.clear();
    this.marketingGoals.clear();

    for (const offering of brief.offerings) {
      this.addOffering(offering.name ?? '', offering.description ?? '');
    }

    for (const point of brief.targetAudience?.painPoints ?? []) {
      this.addPainPoint(point);
    }

    for (const word of brief.brandIdentity?.wordsToAvoid ?? []) {
      this.addWordToAvoid(word);
    }

    for (const goal of brief.marketingGoals) {
      this.addMarketingGoal(goal);
    }
  }

  private patchPlatforms(links: readonly BrandProfileUserPlatformLink[]): void {
    const ids = new Set(links.map((link) => link.userPlatformId));
    const defaultLink = links.find((link) => link.isDefault) ?? links[0] ?? null;
    this.selectedPlatformIds.set(ids);
    this.selectedDefaultId.set(defaultLink?.userPlatformId ?? null);
    this.savedPlatformSnapshot = this.snapshotPlatforms(links);
    this.platformsDirty.set(false);
  }

  private createOfferingGroup(name = '', description = ''): OfferingGroup {
    return new FormGroup({
      name: new FormControl(name, { nonNullable: true }),
      description: new FormControl(description, { nonNullable: true }),
    });
  }

  private buildPlatformLinks(): BrandProfileUserPlatformLink[] {
    const defaultId = this.selectedDefaultId();
    return [...this.selectedPlatformIds()].map((userPlatformId) => ({
      userPlatformId,
      isDefault: userPlatformId === defaultId,
    }));
  }

  private snapshotPlatforms(links: readonly BrandProfileUserPlatformLink[]): string {
    return JSON.stringify(
      [...links]
        .map((link) => ({ id: link.userPlatformId, d: link.isDefault }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    );
  }

  private markPlatformsDirty(): void {
    this.platformsDirty.set(this.snapshotPlatforms(this.buildPlatformLinks()) !== this.savedPlatformSnapshot);
  }
}
