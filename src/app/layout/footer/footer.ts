import { Component } from '@angular/core';

const FOOTER_LINKS = [
  { href: '#features', label: 'Funkcje' },
  { href: '#about', label: 'O nas' },
  { href: '#contact', label: 'Kontakt' },
] as const;

const FOOTER_HIGHLIGHTS = [
  'Szkice z pomocą AI',
  'Proces akceptacji',
  'Harmonogram wielu kanałów',
] as const;

@Component({
  selector: 'app-footer',
  styleUrl: './footer.scss',
  template: `
    <footer class="site-footer">
      <div class="footer-shell">
        <div class="footer-grid">
          <section class="footer-brand" aria-labelledby="footer-brand-title">
            <a href="#top" class="brand" aria-label="Przejdź do góry">
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
              <span id="footer-brand-title" class="brand__name">Starvia</span>
            </a>

            <p class="footer-copy">
              Planuj, twórz, akceptuj i publikuj treści social w jednym spokojnym miejscu
              stworzonym dla nowoczesnych zespołów marketingowych.
            </p>

            <ul class="highlight-list" aria-label="Najważniejsze możliwości Starvia">
              @for (highlight of highlights; track highlight) {
                <li class="highlight-chip">{{ highlight }}</li>
              }
            </ul>
          </section>

          <nav class="footer-column" aria-labelledby="footer-nav-title">
            <p id="footer-nav-title" class="footer-heading">Nawigacja</p>
            @for (link of links; track link.href) {
              <a class="footer-link" [href]="link.href">{{ link.label }}</a>
            }
          </nav>

          <section class="footer-column" aria-labelledby="footer-contact-title">
            <p id="footer-contact-title" class="footer-heading">Kontakt</p>
            <a class="footer-link" href="mailto:hello@starvia.pl">hello@starvia.pl</a>
            <p class="footer-meta">Czas odpowiedzi: do jednego dnia roboczego</p>
            <a
              class="footer-link footer-link--strong"
              href="mailto:hello@starvia.pl?subject=Pro%C5%9Bba%20o%20demo%20Starvia"
            >
              Umów demo
            </a>
          </section>

          <section class="footer-column footer-column--cta" aria-labelledby="footer-cta-title">
            <p id="footer-cta-title" class="footer-heading">Dlaczego zespoły wybierają Starvia</p>
            <p class="footer-meta">
              Strategia, akceptacje i publikacja w jednym miejscu — kampanie idą szybciej, z mniejszą
              liczbą ustaleń w tę i z powrotem.
            </p>
          </section>
        </div>

        <div class="footer-bottom">
          <p>&copy; {{ currentYear }} Starvia. Stworzona dla nowoczesnych zespołów social.</p>
          <p>Wsparcie dla twórców, marketerów i rosnących marek.</p>
        </div>
      </div>
    </footer>
  `,
})
export class Footer {
  protected readonly links = FOOTER_LINKS;
  protected readonly highlights = FOOTER_HIGHLIGHTS;
  protected readonly currentYear = new Date().getFullYear();
}
