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



type DashboardNavChild = {
  label: string;
  route: string;
  icon: string;
  exact?: boolean;
};

type DashboardNavItem = {
  label: string;
  icon: string;
  route?: string;
  exact?: boolean;
  children?: readonly DashboardNavChild[];
};

const NAV_ITEMS: readonly DashboardNavItem[] = [
  { label: 'Overview', icon: 'dashboard', route: '/dashboard', exact: true },
  { label: 'Social accounts', icon: 'link', route: '/dashboard/social-accounts' },
  {
    label: 'Media',
    icon: 'image',
    children: [
      { label: 'Library', icon: 'photo', route: '/dashboard/media', exact: true },
      { label: 'Generate', icon: 'brush', route: '/dashboard/media/generate' },
    ],
  },
  { label: 'Posts', icon: 'notes', route: '/dashboard/posts' },
  { label: 'Prompts', icon: 'chat', route: '/dashboard/prompts' },
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

              @for (item of navItems; track item.label) {

                <li
                  class="dashboard-sidebar__item"
                  [class.dashboard-sidebar__item--expandable]="item.children"
                  [class.is-expanded]="item.children && isNavExpanded(item)"
                  [class.is-section-active]="isNavGroupActive(item)"
                >

                  @if (item.children) {

                    <button
                      type="button"
                      class="dashboard-sidebar__link dashboard-sidebar__link--parent"
                      [class.is-active]="isNavGroupActive(item)"
                      [attr.aria-expanded]="isNavExpanded(item)"
                      [attr.aria-controls]="'nav-group-' + navGroupId(item)"
                      (click)="toggleNavGroup(item)"
                    >
                      <span class="material-icons dashboard-sidebar__nav-icon" aria-hidden="true">{{ item.icon }}</span>
                      <span class="dashboard-sidebar__link-label">{{ item.label }}</span>
                      <span class="material-icons dashboard-sidebar__chevron" aria-hidden="true">expand_more</span>
                    </button>

                    <div
                      class="dashboard-sidebar__sublist-panel"
                      [class.is-open]="isNavExpanded(item)"
                      [id]="'nav-group-' + navGroupId(item)"
                      [attr.aria-hidden]="!isNavExpanded(item)"
                    >
                      <div class="dashboard-sidebar__sublist-inner">
                        <ul class="dashboard-sidebar__sublist">
                        @for (child of item.children; track child.route) {
                          <li>
                            <a
                              [routerLink]="child.route"
                              routerLinkActive="is-active"
                              [routerLinkActiveOptions]="{ exact: child.exact ?? false }"
                              class="dashboard-sidebar__link dashboard-sidebar__link--child"
                              [class.dashboard-sidebar__link--generate]="child.route === '/dashboard/media/generate'"
                              (click)="closeMenu()"
                            >
                              <span class="material-icons dashboard-sidebar__nav-icon" aria-hidden="true">{{ child.icon }}</span>
                              <span class="dashboard-sidebar__link-label">{{ child.label }}</span>
                            </a>
                          </li>
                        }
                        </ul>
                      </div>
                    </div>

                  } @else {

                    <a

                      [routerLink]="item.route"

                      routerLinkActive="is-active"

                      [routerLinkActiveOptions]="{ exact: item.exact ?? false }"

                      class="dashboard-sidebar__link"

                      (click)="closeMenu()"

                    >

                      <span class="material-icons dashboard-sidebar__nav-icon" aria-hidden="true">{{ item.icon }}</span>
                      <span class="dashboard-sidebar__link-label">{{ item.label }}</span>

                    </a>

                  }

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
              <span class="material-icons dashboard-sidebar__action-icon" aria-hidden="true">person</span>
              Account
            </a>

            <button

              type="button"

              class="dashboard-sidebar__action dashboard-sidebar__action--danger"

              [disabled]="isLoggingOut()"

              (click)="logout()"

            >

              <span class="material-icons dashboard-sidebar__action-icon" aria-hidden="true">logout</span>
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

  protected readonly currentUrl = signal(this.router.url);

  private readonly expandedNavLabels = signal<ReadonlySet<string>>(this.readExpandedNavLabels());



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

      .subscribe(() => {
        this.currentUrl.set(this.router.url);
        this.expandedNavLabels.set(this.readExpandedNavLabels());
        this.closeMenu();
      });



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

  protected isNavGroupActive(item: DashboardNavItem): boolean {
    if (!item.children?.length) {
      return false;
    }

    const url = this.normalizeNavUrl(this.currentUrl());
    return item.children.some((child) => this.isNavRouteActive(child.route, child.exact ?? false, url));
  }

  protected isNavExpanded(item: DashboardNavItem): boolean {
    if (this.isNavGroupActive(item)) {
      return true;
    }

    return this.expandedNavLabels().has(item.label);
  }

  protected toggleNavGroup(item: DashboardNavItem): void {
    if (!item.children?.length || this.isNavGroupActive(item)) {
      return;
    }

    const next = new Set(this.expandedNavLabels());
    if (next.has(item.label)) {
      next.delete(item.label);
    } else {
      next.add(item.label);
    }

    this.expandedNavLabels.set(next);
  }

  protected navGroupId(item: DashboardNavItem): string {
    return item.label.trim().toLowerCase().replace(/\s+/g, '-');
  }

  private readExpandedNavLabels(): ReadonlySet<string> {
    const url = this.normalizeNavUrl(this.currentUrl());
    const expanded = new Set<string>();

    for (const item of NAV_ITEMS) {
      if (item.children?.some((child) => this.isNavRouteActive(child.route, child.exact ?? false, url))) {
        expanded.add(item.label);
      }
    }

    return expanded;
  }

  private normalizeNavUrl(url: string): string {
    const path = url.split('?')[0].split('#')[0];
    return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  }

  private isNavRouteActive(route: string, exact: boolean, url = this.normalizeNavUrl(this.currentUrl())): boolean {
    if (exact) {
      return url === route;
    }

    return url === route || url.startsWith(`${route}/`);
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


