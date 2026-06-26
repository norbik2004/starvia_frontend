import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  input,
} from '@angular/core';
import type { SectionStar } from './section-stars';

@Component({
  selector: 'app-section-stars-layer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'section-stars',
    'aria-hidden': 'true',
  },
  template: `
    @for (star of stars(); track star.id) {
      <span
        class="section-star"
        [class.section-star--glyph]="star.glyph"
        [attr.data-star-id]="star.id"
        [attr.style]="star.style"
      ></span>
    }
  `,
})
export class SectionStarsLayer {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly starElById = new Map<number, HTMLElement>();
  private appliedNear = new Set<number>();
  private starsIndexed = false;

  readonly stars = input.required<readonly SectionStar[]>();
  readonly nearIds = input.required<ReadonlySet<number>>();

  constructor() {
    afterNextRender(() => this.indexStarElements());

    effect(() => {
      this.syncNearClasses(this.nearIds());
    });
  }

  private indexStarElements(): void {
    if (this.starsIndexed) {
      return;
    }

    this.starElById.clear();
    for (const node of Array.from(this.host.nativeElement.querySelectorAll('.section-star'))) {
      const el = node as HTMLElement;
      const id = Number(el.dataset['starId']);
      if (!Number.isNaN(id)) {
        this.starElById.set(id, el);
      }
    }

    this.starsIndexed = true;
  }

  private syncNearClasses(nextNear: ReadonlySet<number>): void {
    if (!this.starsIndexed) {
      return;
    }

    for (const id of this.appliedNear) {
      if (!nextNear.has(id)) {
        this.starElById.get(id)?.classList.remove('section-star--near');
      }
    }

    for (const id of nextNear) {
      if (!this.appliedNear.has(id)) {
        this.starElById.get(id)?.classList.add('section-star--near');
      }
    }

    this.appliedNear = new Set(nextNear);
  }
}
