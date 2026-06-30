import { Component, DestroyRef, HostListener, OnDestroy, inject, signal } from '@angular/core';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { MatTooltip } from '@angular/material/tooltip';

import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';

import { catchError, filter, finalize, of } from 'rxjs';

import type { UserAccount } from '../../../models/user-account';
import { AuthService } from '../../../services/auth';
import { SessionService } from '../../../services/session';
import { mountDrawerBodyBackdrop } from '../../../layout/shared/drawer-body-backdrop';
import { DashboardUserAvatar } from '../shared/dashboard-user-avatar/dashboard-user-avatar';



type DashboardNavItem = {

  label: string;

  route: string;

  exact?: boolean;

};



const NAV_ITEMS: readonly DashboardNavItem[] = [

  { label: 'Overview', route: '/dashboard', exact: true },
  
  { label: 'Social accounts', route: '/dashboard/social-accounts' },

  { label: 'Media', route: '/dashboard/media' },

  { label: 'Posts', route: '/dashboard/posts' },

  { label: 'Prompts', route: '/dashboard/prompts' },

  

] as const;



@Component({

  selector: 'app-dashboard-sidebar',

  imports: [RouterLink, RouterLinkActive, MatTooltip, DashboardUserAvatar],

  styleUrl: './dashboard-sidebar.scss',

  template: `

    <aside class="dashboard-sidebar" [class.is-menu-open]="menuOpen()" aria-label="Dashboard">

      <div class="dashboard-sidebar__mobile-bar">

        <a routerLink="/dashboard" class="brand" aria-label="Starvia dashboard" (click)="closeMenu()">

          <span class="brand__icon-wrap">

            <img

              class="brand__icon"

              src="/starvia-logo.png"

              alt=""

              width="44"

              height="44"

              decoding="async"

            />

          </span>

          <span class="brand__name">Starvia</span>

        </a>



        <button

          type="button"

          class="dashboard-sidebar__menu-toggle"

          [attr.aria-expanded]="menuOpen()"

          aria-controls="dashboard-sidebar-panel"

          (click)="toggleMenu()"

        >

          <span class="sr-only">{{ menuOpen() ? 'Close menu' : 'Open menu' }}</span>

          <span class="menu-icon" [class.is-open]="menuOpen()" aria-hidden="true"></span>

        </button>

      </div>





      <div id="dashboard-sidebar-panel" class="dashboard-sidebar__panel">

        <div class="dashboard-sidebar__drawer-head">

          <p class="dashboard-sidebar__eyebrow">Workspace</p>

          <button type="button" class="dashboard-sidebar__close" aria-label="Close menu" (click)="closeMenu()">

            <span class="close-icon" aria-hidden="true"></span>

          </button>

        </div>



        <div class="dashboard-sidebar__body">

          <a

            routerLink="/dashboard"

            class="dashboard-sidebar__brand dashboard-sidebar__brand--desktop"

            aria-label="Starvia dashboard"

            (click)="closeMenu()"

          >

            <span class="dashboard-sidebar__brand-icon-wrap">

              <img

                class="dashboard-sidebar__brand-icon"

                src="/starvia-logo.png"

                alt=""

                width="44"

                height="44"

                decoding="async"

              />

            </span>

            <span class="dashboard-sidebar__brand-name">Starvia</span>

          </a>



          <p class="dashboard-sidebar__eyebrow dashboard-sidebar__eyebrow--desktop">Workspace</p>



          <nav class="dashboard-sidebar__nav" aria-label="Dashboard navigation">

            <ul class="dashboard-sidebar__list">

              @for (item of navItems; track item.route) {

                <li>

                  <a

                    [routerLink]="item.route"

                    routerLinkActive="is-active"

                    [routerLinkActiveOptions]="{ exact: item.exact ?? false }"

                    class="dashboard-sidebar__link"

                    (click)="closeMenu()"

                  >

                    {{ item.label }}

                  </a>

                </li>

              }

            </ul>

          </nav>

        </div>



        <div class="dashboard-sidebar__footer">

          <div class="dashboard-sidebar__user-row">

            @if (account(); as profile) {
              <app-dashboard-user-avatar
                [userName]="profile.userName"
                [profilePictureUrl]="profile.profilePictureUrl"
              />
            } @else {
              <app-dashboard-user-avatar userName="Account" />
            }

            <div class="dashboard-sidebar__identity">

              <span class="dashboard-sidebar__name">{{ account()?.userName ?? 'Account' }}</span>

              @if (account()?.email; as email) {

                <span class="dashboard-sidebar__email">{{ email }}</span>

              }

            </div>

            <button

              type="button"

              class="dashboard-sidebar__notifications"

              aria-label="Notifications"

              matTooltip="Notifications"

              matTooltipPosition="below"

            >

              <span class="material-icons dashboard-sidebar__notifications-icon" aria-hidden="true">

                notifications

              </span>

            </button>

          </div>



          <div class="dashboard-sidebar__user-actions">

            <a
              routerLink="/dashboard/account"
              routerLinkActive="is-active"
              [routerLinkActiveOptions]="{ exact: true }"
              class="dashboard-sidebar__action"
              (click)="closeMenu()"
            >
              Account
            </a>

            <button

              type="button"

              class="dashboard-sidebar__action dashboard-sidebar__action--danger"

              [disabled]="isLoggingOut()"

              (click)="logout()"

            >

              {{ isLoggingOut() ? 'Logging out…' : 'Log out' }}

            </button>

          </div>

        </div>

      </div>

    </aside>

  `,

})

export class DashboardSidebar implements OnDestroy {

  private readonly authService = inject(AuthService);

  private readonly session = inject(SessionService);

  private readonly router = inject(Router);

  private readonly destroyRef = inject(DestroyRef);

  private unmountBodyBackdrop: (() => void) | null = null;



  protected readonly navItems = NAV_ITEMS;

  protected readonly account = signal<UserAccount | null>(null);

  protected readonly isLoggingOut = signal(false);

  protected readonly menuOpen = signal(false);



  constructor() {

    this.session.checkOnce().subscribe((loggedIn) => {

      if (loggedIn) {

        this.loadAccount();

      }

    });



    this.router.events

      .pipe(

        filter((event): event is NavigationEnd => event instanceof NavigationEnd),

        takeUntilDestroyed(this.destroyRef)

      )

      .subscribe(() => this.closeMenu());



    this.authService.accountChanges$

      .pipe(takeUntilDestroyed(this.destroyRef))

      .subscribe((profile) => this.account.set(profile));

  }



  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.closeMenu();
  }



  protected toggleMenu(): void {

    this.setMenuOpen(!this.menuOpen());

  }



  protected closeMenu(): void {

    this.setMenuOpen(false);

  }



  protected logout(): void {

    this.isLoggingOut.set(true);

    this.closeMenu();



    this.authService

      .logout()

      .pipe(

        catchError(() => of(null)),

        finalize(() => this.isLoggingOut.set(false))

      )

      .subscribe(() => {

        this.session.setLoggedOut();

        this.account.set(null);

        void this.router.navigateByUrl('/login');

      });

  }



  private loadAccount(): void {

    this.authService.getAccount().subscribe({

      next: (profile) => this.account.set(profile),

      error: () => this.account.set(null),

    });

  }



  ngOnDestroy(): void {
    this.clearBodyBackdrop();
    document.body.classList.remove('dashboard-nav-open');
  }



  private setMenuOpen(open: boolean): void {

    this.menuOpen.set(open);

    document.body.classList.toggle('dashboard-nav-open', open);

    if (open) {
      this.clearBodyBackdrop();
      this.unmountBodyBackdrop = mountDrawerBodyBackdrop('Close menu', () => this.closeMenu());
    } else {
      this.clearBodyBackdrop();
    }

  }

  private clearBodyBackdrop(): void {
    this.unmountBodyBackdrop?.();
    this.unmountBodyBackdrop = null;
  }

}


