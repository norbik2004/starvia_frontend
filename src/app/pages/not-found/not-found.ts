import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  OnDestroy,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Header } from '../../layout/header/header';
import { createHeroStars } from '../../layout/shared/section-stars';
import { createSectionStarsInteraction } from '../../layout/shared/section-stars-pointer';
import { SectionStarsLayer } from '../../layout/shared/section-stars-layer';
import { PageRevealDirective } from '../../directives/page-reveal';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink, Header, SectionStarsLayer, PageRevealDirective],
  styleUrl: './not-found.scss',
  template: `
    <app-header
      [links]="[]"
      actionLabel="Log in"
      actionRoute="/login"
      navLabel="Page not found navigation"
      brandMode="route"
      brandRoute="/"
    />

    <main
      class="not-found"
      (mousemove)="starsInteraction.onPointerMove($event)"
      (mouseleave)="starsInteraction.onPointerLeave()"
    >
      <div class="not-found__bg" aria-hidden="true">
        <app-section-stars-layer
          class="not-found__stars"
          [stars]="stars"
          [nearIds]="starsInteraction.nearStarIds()"
        />
      </div>

      <div class="not-found__content" appPageReveal>
        <p class="not-found__code">404</p>
        <h1 class="not-found__title">Page not found</h1>
        <p class="not-found__message">The page you are looking for does not exist.</p>
        <div class="not-found__actions">
          <a routerLink="/" class="btn btn--primary">Back to home</a>
          <a routerLink="/login" class="btn btn--secondary">Log in</a>
        </div>
      </div>
    </main>
  `,
})
export class NotFoundPage implements AfterViewInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly stars = createHeroStars();
  protected readonly starsInteraction = createSectionStarsInteraction(this.stars);

  ngAfterViewInit(): void {
    const section = this.host.nativeElement.querySelector('.not-found');
    if (section instanceof HTMLElement) {
      this.starsInteraction.attach(section);
    }
  }

  ngOnDestroy(): void {
    this.starsInteraction.destroy();
  }
}
