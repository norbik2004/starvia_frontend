import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Header } from '../../layout/header/header';
import { createHeroStars } from '../../layout/shared/section-stars';
import { createSectionStarsInteraction } from '../../layout/shared/section-stars-pointer';
import { SectionStarsLayer } from '../../layout/shared/section-stars-layer';
import { PageRevealDirective } from '../../directives/page-reveal';
import { lockAuthPageBody } from '../shared/auth-page-body-lock';

@Component({
  selector: 'app-reset-password-success-page',
  imports: [Header, SectionStarsLayer, PageRevealDirective, RouterLink],
  styleUrl: './reset-password-success.scss',
  template: `
    <app-header
      [links]="[]"
      actionLabel="Back home"
      actionRoute="/"
      navLabel="Reset password success navigation"
      brandMode="route"
      brandRoute="/"
    />

    <main
      class="reset-password-success"
      (mousemove)="starsInteraction.onPointerMove($event)"
      (mouseleave)="starsInteraction.onPointerLeave()"
    >
      <div class="reset-password-success__bg" aria-hidden="true">
        <app-section-stars-layer
          class="reset-password-success__stars"
          [stars]="stars"
          [nearIds]="starsInteraction.nearStarIds()"
        />
      </div>

      <div class="reset-password-success__content" appPageReveal>
        <p class="reset-password-success__code">✓</p>
        <h1 class="reset-password-success__title">Password updated</h1>
        <p class="reset-password-success__message">
          Your password has been changed successfully. Redirecting to your account in
          <span class="reset-password-success__countdown">{{ secondsLeft() }}s</span>.
        </p>
        <a routerLink="/dashboard/account" class="btn btn--primary">Go to account now</a>
      </div>
    </main>
  `,
})
export class ResetPasswordSuccessPage implements AfterViewInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly secondsLeft = signal(5);
  protected readonly stars = createHeroStars();
  protected readonly starsInteraction = createSectionStarsInteraction(this.stars);

  constructor() {
    lockAuthPageBody();
    this.startRedirectCountdown();
  }

  ngAfterViewInit(): void {
    const section = this.host.nativeElement.querySelector('.reset-password-success');
    if (section instanceof HTMLElement) {
      this.starsInteraction.attach(section);
    }
  }

  ngOnDestroy(): void {
    this.starsInteraction.destroy();
  }

  private startRedirectCountdown(): void {
    const intervalId = window.setInterval(() => {
      this.secondsLeft.update((value) => Math.max(0, value - 1));
    }, 1000);

    const timeoutId = window.setTimeout(() => {
      void this.router.navigateByUrl('/dashboard/account');
    }, 5000);

    this.destroyRef.onDestroy(() => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    });
  }
}
