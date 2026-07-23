import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Footer } from '../../layout/footer/footer';
import { Header } from '../../layout/header/header';
import { Hero } from '../../layout/hero/hero';
import { Features } from '../../layout/features/features';
import { PageRevealDirective } from '../../directives/page-reveal';

@Component({
  selector: 'app-home-page',
  imports: [Header, Hero, Features, Footer, PageRevealDirective, RouterLink],
  styleUrl: './home.scss',
  template: `
    <div appPageReveal class="home">
      <app-header />
      <app-hero [title]="title" />
      <main>
        <app-features />

        <section id="about" class="page-section pitch-section">
          <div class="section-inner pitch-section__inner">
            <header class="section-header section-header--centered">
              <p class="section-eyebrow">Dlaczego Starvia</p>
              <h2 class="section-title">Stworzona dla nowoczesnych zespołów social.</h2>
              <p class="section-lead">
                Planuj treści, współpracuj z AI i publikuj pewnie — tak, by każdy post naprawdę
                zdobywał uwagę.
              </p>
              <a routerLink="/register" class="pitch-section__cta">Wypróbuj Starvia</a>
            </header>
          </div>
        </section>

        <section id="contact" class="page-section pitch-section pitch-section--muted">
          <div class="section-inner pitch-section__inner">
            <header class="section-header section-header--centered">
              <p class="section-eyebrow">Kontakt</p>
              <h2 class="section-title">Porozmawiajmy.</h2>
              <p class="section-lead">
                Pytania o Starvia albo wczesny dostęp? Napisz do nas — odezwiemy się wkrótce.
              </p>
            </header>
          </div>
        </section>
      </main>
      <app-footer />
    </div>
  `,
})
export class HomePage {
  protected readonly title = 'Starvia';
}
