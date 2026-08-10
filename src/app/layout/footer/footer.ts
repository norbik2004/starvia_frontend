import { Component } from '@angular/core';

const FOOTER_LINKS = [
  { href: '#features', label: 'Funkcje' },
  { href: '#channels', label: 'Kanały' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#contact', label: 'Kontakt' },
] as const;

@Component({
  selector: 'app-footer',
  styleUrl: './footer.scss',
  template: `
    <footer class="site-footer">
      <div class="footer-shell">
        <blockquote class="footer-quote">
          <p class="footer-quote__mark" aria-hidden="true">”</p>
          <p class="footer-quote__text">Content is king, but context is God.</p>
          <cite class="footer-quote__cite">Gary Vaynerchuk</cite>
        </blockquote>

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
              Zarządzanie treścią, AI copy i obrazy marki, kalendarz publikacji — Facebook, Instagram i LinkedIn
              w jednym miejscu.
            </p>
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
            <a
              class="footer-demo"
              href="mailto:hello@starvia.pl?subject=Pro%C5%9Bba%20o%20demo%20Starvia"
            >
              Umów demo
            </a>
          </section>
        </div>

        <div class="footer-bottom">
          <p class="footer-bottom__copy">&copy; {{ currentYear }} Starvia</p>
          <p class="footer-bottom__tag">Dla twórców, marketerów i zespołów social.</p>
        </div>
      </div>
    </footer>
  `,
})
export class Footer {
  protected readonly links = FOOTER_LINKS;
  protected readonly currentYear = new Date().getFullYear();
}
