import { Component, HostListener, Input, OnDestroy, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { SessionService } from '../../services/session';

type HeaderLink = {
  id: string;
  label: string;
};

const LINKS: readonly HeaderLink[] = [
  { id: 'features', label: 'Features' },
  { id: 'about', label: 'About' },
  { id: 'contact', label: 'Contact' },
] as const;

const SCROLL_ON_THRESHOLD_PX = 24;
const SCROLL_OFF_THRESHOLD_PX = 8;

@Component({
  selector: 'app-header',
  imports: [RouterLink],
  styleUrl: './header.scss',
  host: {
    '[class.is-header-hidden]': 'headerHidden()',
  },
  template: `
    <header class="site-header" [class.is-scrolled]="scrolled()" [class.is-at-top]="!scrolled()">
      <div class="header-shell">
        <div class="header-bar">
        @if (brandMode === 'route') {
          <a [routerLink]="brandRoute" class="brand" aria-label="Go to Starvia home" (click)="closeMenu()">
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
        } @else {
          <a href="#top" class="brand" (click)="go($event, 'top')">
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
        }

        <button
          type="button"
          class="menu-toggle"
          [attr.aria-expanded]="menuOpen()"
          aria-controls="site-nav"
          (click)="toggleMenu()"
        >
          <span class="sr-only">{{ menuOpen() ? 'Close menu' : 'Open menu' }}</span>
          <span class="menu-icon" [class.is-open]="menuOpen()" aria-hidden="true"></span>
        </button>
        </div>
      </div>

      <nav
        id="site-nav"
        class="nav"
        [class.is-open]="menuOpen()"
        [attr.aria-label]="navLabel"
      >
        <div class="nav-drawer-head">
          <button
            type="button"
            class="nav-close"
            aria-label="Close menu"
            (click)="closeMenu()"
          >
            <span class="close-icon" aria-hidden="true"></span>
          </button>
        </div>
        @for (link of links; track link.id) {
          <a [href]="'#' + link.id" class="nav-link" (click)="go($event, link.id)">
            {{ link.label }}
          </a>
        }
        @if (session.loggedIn()) {
          <a [routerLink]="'/dashboard'" class="btn btn--raised-secondary" (click)="closeMenu()">Dashboard</a>
        } @else {
          <a [routerLink]="actionRoute" class="btn btn--raised-secondary" (click)="closeMenu()">
            {{ actionLabel }}
          </a>
        }
      </nav>

      @if (menuOpen()) {
        <button
          type="button"
          class="nav-backdrop"
          aria-label="Close menu"
          (click)="closeMenu()"
        ></button>
      }
    </header>
  `,
})
export class Header implements OnDestroy {
  private readonly router = inject(Router);
  protected readonly session = inject(SessionService);

  @Input() links: readonly HeaderLink[] = LINKS;
  @Input() actionLabel = 'Log in';
  @Input() actionRoute = '/login';
  @Input() navLabel = 'Sections';
  @Input() brandMode: 'scroll' | 'route' = 'scroll';
  @Input() brandRoute = '/';
  protected readonly menuOpen = signal(false);
  protected readonly scrolled = signal(false);
  protected readonly headerHidden = signal(false);

  private lastScrollY = 0;
  private scrollRafId = 0;

  private readonly onScroll = (): void => {
    if (this.scrollRafId !== 0) {
      return;
    }

    this.scrollRafId = requestAnimationFrame(() => {
      this.scrollRafId = 0;
      this.applyScrollState(window.scrollY);
    });
  };

  private applyScrollState(scrollY: number): void {
    const wasScrolled = this.scrolled();
    const nextScrolled =
      scrollY > SCROLL_ON_THRESHOLD_PX ? true : scrollY < SCROLL_OFF_THRESHOLD_PX ? false : wasScrolled;

    if (nextScrolled !== wasScrolled) {
      this.scrolled.set(nextScrolled);
    }

    if (!this.shouldAutoHideOnScroll() || this.menuOpen() || scrollY <= SCROLL_ON_THRESHOLD_PX) {
      this.headerHidden.set(false);
    } else if (scrollY > this.lastScrollY) {
      this.headerHidden.set(true);
    } else if (scrollY < this.lastScrollY) {
      this.headerHidden.set(false);
    }

    this.lastScrollY = scrollY;
  }

  constructor() {
    this.applyScrollState(window.scrollY);
    window.addEventListener('scroll', this.onScroll, { passive: true });
    this.session.checkOnce().subscribe();

    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.applyScrollState(window.scrollY);
    });
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.onScroll);
    if (this.scrollRafId !== 0) {
      cancelAnimationFrame(this.scrollRafId);
      this.scrollRafId = 0;
    }
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

  protected go(event: Event, id: string): void {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
    history.replaceState(null, '', `#${id}`);
    this.closeMenu();
  }

  private setMenuOpen(open: boolean): void {
    this.menuOpen.set(open);
    document.body.classList.toggle('nav-open', open);

    if (open) {
      this.headerHidden.set(false);
    }
  }

  private shouldAutoHideOnScroll(): boolean {
    return this.brandMode === 'scroll';
  }
}
