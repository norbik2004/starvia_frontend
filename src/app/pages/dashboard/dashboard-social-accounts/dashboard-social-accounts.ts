import { DOCUMENT, NgClass } from '@angular/common';

import { Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';

import { RouterLink } from '@angular/router';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { forkJoin, fromEvent } from 'rxjs';

import { filter, finalize } from 'rxjs/operators';

import { toApplicationError } from '../../../models/application-error';

import {

  getPlatformBrandClass,

  getPlatformDescription,

  groupPlatformsByCategory,

  isPlatformConnectable,

  type Platform,

} from '../../../models/platform';

import {

  getConnectablePlatformBrandClass,

  getPlatformLabel,

  type UserPlatform,

  userPlatformPhotoKey,

} from '../../../models/user-platform';

import { LinkedInService } from '../../../services/linkedin';

import { PlatformService } from '../../../services/platform';

import { UserPlatformService } from '../../../services/user-platform';

import { PageLoading } from '../../../components/page-loading/page-loading';

import { PageRevealDirective } from '../../../directives/page-reveal';

import { DashboardPlatformLogo } from '../shared/dashboard-platform-logo/dashboard-platform-logo';

import { DashboardUserAvatar } from '../shared/dashboard-user-avatar/dashboard-user-avatar';



@Component({

  selector: 'app-dashboard-social-accounts',

  imports: [

    PageLoading,

    PageRevealDirective,

    DashboardUserAvatar,

    DashboardPlatformLogo,

    NgClass,

    RouterLink,

  ],

  styleUrl: './dashboard-social-accounts.scss',

  template: `
    <section class="dashboard-content-page dashboard-social-accounts" aria-labelledby="dashboard-social-accounts-title">
      <div appPageReveal>
        <header class="dashboard-social-accounts__header">
          <div class="dashboard-social-accounts__header-copy">
            <p class="section-eyebrow dashboard-social-accounts__eyebrow">Workspace settings</p>
            <h1 id="dashboard-social-accounts-title" class="dashboard-social-accounts__title">
              Social accounts
              <span class="dashboard-social-accounts__title-mark" aria-hidden="true">all together</span>
            </h1>
            <p class="dashboard-social-accounts__intro">
              Connect the channels you use and keep every publishing identity within reach.
            </p>
          </div>
          <p class="dashboard-social-accounts__scribble" aria-hidden="true">Grow from here.</p>
        </header>
      </div>

      @if (isLoading()) {
        <app-page-loading label="Loading platforms…" />
      }

      @if (loadError()) {
        <div class="dashboard-route-status dashboard-route-status--error" role="alert">
          <span class="material-icons" aria-hidden="true">cloud_off</span>
          <p>{{ loadError() }}</p>
        </div>
      }

      @if (!isLoading() && !loadError()) {
        <div class="dashboard-social-accounts__body" appPageReveal>
          <article class="account-panel account-panel--social" aria-labelledby="social-accounts-manage-title">
            <div class="account-panel__head">
              <span class="account-panel__icon" aria-hidden="true">
                <span class="material-icons">hub</span>
              </span>
              <div class="account-panel__head-copy">
                <h2 id="social-accounts-manage-title" class="account-panel__title">Connect platforms</h2>
                <p class="account-panel__copy">
                  Link social accounts to publish content from Starvia.
                </p>
              </div>
            </div>

            @if (platformsMessage(); as message) {
              <p class="account-panel__status account-panel__status--success" role="status">
                {{ message }}
              </p>
            }

            @if (connectedAccounts().length > 0) {
              <div class="social-accounts__connected">
                <h3 class="social-accounts__section-title">Connected accounts</h3>
                <ul class="social-accounts__list" appPageReveal [appPageRevealList]="true">
                  @for (connection of connectedAccounts(); track connection.id) {
                    <li>
                      <a
                        [routerLink]="['/dashboard/social-accounts', connection.id]"
                        class="social-account-card social-account-card--connected social-account-card--link"
                        [ngClass]="platformBrandClass(connection.platformId)"
                      >
                        <div class="social-account-card__identity">
                          <div class="social-account-card__visual">
                            <app-dashboard-platform-logo
                              [platformType]="platformLabel(connection.platformId)"
                              size="md"
                            />

                            @if (showPlatformPhoto(connection)) {
                              <img
                                class="social-account-card__photo"
                                [src]="connection.profilePictureLink"
                                [alt]="connection.accountUsername + ' profile photo'"
                                (error)="onPlatformPhotoError(connection)"
                              />
                            } @else {
                              <app-dashboard-user-avatar
                                size="md"
                                [userName]="connection.accountUsername"
                                [profilePictureUrl]="null"
                              />
                            }
                          </div>

                          <div class="social-account-card__copy">
                            <div class="social-account-card__headline">
                              <h3 class="social-account-card__name">{{ platformLabel(connection.platformId) }}</h3>
                              <span class="social-account-card__badge">Connected</span>
                            </div>
                            <p class="social-account-card__username">{{ connection.accountUsername }}</p>
                            @if (connection.accountComment) {
                              <p class="social-account-card__comment">{{ connection.accountComment }}</p>
                            }
                          </div>
                        </div>

                        <span class="social-account-card__chevron material-icons" aria-hidden="true">chevron_right</span>
                      </a>
                    </li>
                  }
                </ul>
              </div>
            } @else {
              <div class="social-accounts__empty">
                <span class="social-accounts__empty-icon material-icons" aria-hidden="true">link</span>
                <div class="social-accounts__empty-copy">
                  <h3>Start with your first channel</h3>
                  <p>Choose an available platform below. Your connected accounts will live here.</p>
                </div>
              </div>
            }

            @for (group of platformCategories(); track group.category.key) {
              <section
                class="social-accounts__category"
                [attr.aria-labelledby]="'platform-category-' + group.category.key"
              >
                <h3 class="social-accounts__section-title" [id]="'platform-category-' + group.category.key">
                  <span class="material-icons social-accounts__section-icon" aria-hidden="true">{{ group.category.icon }}</span>
                  {{ group.category.label }}
                </h3>

                <ul class="social-accounts__list" appPageReveal [appPageRevealList]="true">
                  @for (platform of group.platforms; track platform.id) {
                    <li>
                      <article class="social-account-card" [ngClass]="getPlatformBrandClass(platform.type)">
                        <div class="social-account-card__identity">
                          <app-dashboard-platform-logo [platformType]="platform.type" size="lg" />

                          <div class="social-account-card__copy">
                            <h4 class="social-account-card__name">{{ platform.type }}</h4>
                            <p class="social-account-card__description">{{ getPlatformDescription(platform.type) }}</p>
                          </div>
                        </div>

                        <div class="social-account-card__actions">
                          @if (isPlatformConnectable(platform)) {
                            <button
                              type="button"
                              class="account-panel__btn account-panel__btn--primary"
                              [disabled]="isConnectingLinkedIn()"
                              (click)="connectLinkedIn()"
                            >
                              <span class="material-icons" aria-hidden="true">add_link</span>
                              {{ isConnectingLinkedIn() ? 'Redirecting…' : 'Connect ' + platform.type }}
                            </button>
                          } @else {
                            <span class="social-account-card__soon">Work in progress</span>
                          }
                        </div>
                      </article>
                    </li>
                  }
                </ul>
              </section>
            }
          </article>
        </div>
      }
    </section>
  `,

})

export class DashboardSocialAccounts {

  private readonly linkedInService = inject(LinkedInService);

  private readonly platformService = inject(PlatformService);

  private readonly userPlatformService = inject(UserPlatformService);

  private readonly destroyRef = inject(DestroyRef);

  private readonly document = inject(DOCUMENT);



  protected readonly isPlatformConnectable = isPlatformConnectable;

  protected readonly getPlatformBrandClass = getPlatformBrandClass;

  protected readonly getPlatformDescription = getPlatformDescription;



  protected readonly availablePlatforms = signal<Platform[]>([]);

  protected readonly connectedAccounts = signal<UserPlatform[]>([]);

  protected readonly platformCategories = computed(() => {

    const connectedIds = new Set(this.connectedAccounts().map((account) => account.platformId));



    return groupPlatformsByCategory(this.availablePlatforms())

      .map((group) => ({

        ...group,

        platforms: group.platforms.filter((platform) => !connectedIds.has(platform.id)),

      }))

      .filter((group) => group.platforms.length > 0);

  });



  protected readonly isLoading = signal(true);

  protected readonly isConnectingLinkedIn = signal(false);

  protected readonly loadError = signal<string | null>(null);

  protected readonly platformsMessage = signal<string | null>(null);

  protected readonly platformPhotoErrors = signal<ReadonlySet<string>>(new Set());



  private dataLoaded = false;



  constructor() {

    this.loadData();

    this.bindPlatformRefreshOnReturn();

  }



  @HostListener('window:focus')

  protected onWindowFocus(): void {

    if (this.dataLoaded) {

      this.loadData({ silent: true });

    }

  }



  protected platformLabel(platformId: number): string {

    const platform = this.availablePlatforms().find((item) => item.id === platformId);

    return platform?.type ?? getPlatformLabel(platformId);

  }



  protected platformBrandClass(platformId: number): string {

    const platform = this.availablePlatforms().find((item) => item.id === platformId);

    return platform ? getPlatformBrandClass(platform.type) : getConnectablePlatformBrandClass(platformId);

  }



  protected showPlatformPhoto(connection: UserPlatform): boolean {

    const key = userPlatformPhotoKey(connection);

    return !!connection.profilePictureLink && !this.platformPhotoErrors().has(key);

  }



  protected onPlatformPhotoError(connection: UserPlatform): void {

    const key = userPlatformPhotoKey(connection);

    this.platformPhotoErrors.update((errors) => {

      const next = new Set(errors);

      next.add(key);

      return next;

    });

  }



  protected connectLinkedIn(): void {

    if (this.isConnectingLinkedIn()) return;



    this.isConnectingLinkedIn.set(true);

    this.loadError.set(null);



    this.linkedInService

      .getAuthorizationUrl()

      .pipe(finalize(() => this.isConnectingLinkedIn.set(false)))

      .subscribe({

        next: (url) => {

          this.document.defaultView?.location.assign(url);

        },

        error: (error) => {

          this.loadError.set(

            toApplicationError(error, 'Could not start LinkedIn authorization. Please try again.').description

          );

        },

      });

  }



  private bindPlatformRefreshOnReturn(): void {

    fromEvent(this.document, 'visibilitychange')

      .pipe(

        filter(() => this.document.visibilityState === 'visible'),

        takeUntilDestroyed(this.destroyRef)

      )

      .subscribe(() => {

        if (this.dataLoaded) {

          this.loadData({ silent: true });

        }

      });

  }



  private loadData(options: { silent?: boolean } = {}): void {

    if (!options.silent) {

      this.isLoading.set(true);

    }



    this.loadError.set(null);



    forkJoin({

      available: this.platformService.getPlatforms(),

      connected: this.userPlatformService.getUserPlatforms(),

    })

      .pipe(finalize(() => this.isLoading.set(false)))

      .subscribe({

        next: ({ available, connected }) => {

          this.dataLoaded = true;

          this.availablePlatforms.set(available);

          this.connectedAccounts.set(connected);

          this.platformPhotoErrors.set(new Set());



          if (options.silent && connected.length > 0) {

            this.platformsMessage.set('Connected accounts updated.');

          }

        },

        error: (error) => {

          this.loadError.set(toApplicationError(error, 'Could not load platforms.').description);

        },

      });

  }

}


