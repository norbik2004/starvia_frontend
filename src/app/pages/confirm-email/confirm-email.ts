import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  OnDestroy,
} from '@angular/core';
import { Header } from '../../layout/header/header';
import { createHeroStars } from '../../layout/shared/section-stars';
import { createSectionStarsInteraction } from '../../layout/shared/section-stars-pointer';
import { SectionStarsLayer } from '../../layout/shared/section-stars-layer';
import { PageRevealDirective } from '../../directives/page-reveal';
import { lockAuthPageBody } from '../shared/auth-page-body-lock';

function readRegisteredEmail(): string | null {
  const email = history.state?.['email'];

  return typeof email === 'string' && email.trim().length > 0 ? email.trim() : null;
}

@Component({
  selector: 'app-confirm-email-page',
  imports: [Header, SectionStarsLayer, PageRevealDirective],
  styleUrl: './confirm-email.scss',
  template: `
    <app-header
      [links]="[]"
      actionLabel="Back home"
      actionRoute="/"
      navLabel="Confirm email navigation"
      brandMode="route"
      brandRoute="/"
    />

    <main
      class="confirm-email"
      (mousemove)="starsInteraction.onPointerMove($event)"
      (mouseleave)="starsInteraction.onPointerLeave()"
    >
      <div class="confirm-email__bg" aria-hidden="true">
        <app-section-stars-layer
          class="confirm-email__stars"
          [stars]="stars"
          [nearIds]="starsInteraction.nearStarIds()"
        />
      </div>

      <div class="confirm-email__content" appPageReveal>
        <p class="confirm-email__code">✉</p>
        <h1 class="confirm-email__title">Confirm your email</h1>
        <p class="confirm-email__message">
          We sent a confirmation link to your inbox. Open it to verify your account.
        </p>

        @if (registeredEmail; as email) {
          <p class="confirm-email__email">{{ email }}</p>
        }

        <p class="confirm-email__hint">
          If you don't see it, check spam or promotions and wait a minute before trying again.
        </p>
      </div>
    </main>
  `,
})
export class ConfirmEmailPage implements AfterViewInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly registeredEmail = readRegisteredEmail();
  protected readonly stars = createHeroStars();
  protected readonly starsInteraction = createSectionStarsInteraction(this.stars);

  constructor() {
    lockAuthPageBody();
  }

  ngAfterViewInit(): void {
    const section = this.host.nativeElement.querySelector('.confirm-email');
    if (section instanceof HTMLElement) {
      this.starsInteraction.attach(section);
    }
  }

  ngOnDestroy(): void {
    this.starsInteraction.destroy();
  }
}
