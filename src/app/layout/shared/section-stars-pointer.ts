import { signal } from '@angular/core';
import { getNearStarIds, type SectionStar } from './section-stars';

const HOVER_CAPABLE =
  typeof matchMedia !== 'undefined' && matchMedia('(hover: hover) and (pointer: fine)').matches;

const POINTER_MOVE_EPSILON_SQ = 16;
const SCROLL_IDLE_MS = 140;
const SECTION_STARS_PAUSED_CLASS = 'section-stars-paused';

type SectionBinding = {
  el: HTMLElement;
  isIntersecting: boolean;
};

let scrollListenerCount = 0;
let scrollEndTimer = 0;
let isScrolling = false;
const boundSections = new Map<HTMLElement, SectionBinding>();
const scrollClearCallbacks = new Set<() => void>();

function syncSectionPaused(binding: SectionBinding): void {
  binding.el.classList.toggle(
    SECTION_STARS_PAUSED_CLASS,
    !binding.isIntersecting || isScrolling
  );
}

function syncAllSectionsPaused(): void {
  for (const binding of boundSections.values()) {
    syncSectionPaused(binding);
  }
}

function onGlobalScroll(): void {
  if (!isScrolling) {
    isScrolling = true;
    syncAllSectionsPaused();
    for (const clear of scrollClearCallbacks) {
      clear();
    }
  }

  window.clearTimeout(scrollEndTimer);
  scrollEndTimer = window.setTimeout(() => {
    isScrolling = false;
    syncAllSectionsPaused();
  }, SCROLL_IDLE_MS);
}

function registerScrollPause(el: HTMLElement): void {
  boundSections.set(el, { el, isIntersecting: true });
  syncSectionPaused(boundSections.get(el)!);

  if (scrollListenerCount === 0) {
    window.addEventListener('scroll', onGlobalScroll, { passive: true, capture: true });
  }

  scrollListenerCount++;
}

function unregisterScrollPause(el: HTMLElement): void {
  boundSections.delete(el);
  el.classList.remove(SECTION_STARS_PAUSED_CLASS);

  scrollListenerCount = Math.max(0, scrollListenerCount - 1);
  if (scrollListenerCount === 0) {
    window.clearTimeout(scrollEndTimer);
    scrollEndTimer = 0;
    isScrolling = false;
    window.removeEventListener('scroll', onGlobalScroll, { capture: true });
  }
}

function setSectionIntersecting(el: HTMLElement, intersecting: boolean): void {
  const binding = boundSections.get(el);
  if (!binding) {
    return;
  }

  binding.isIntersecting = intersecting;
  syncSectionPaused(binding);
}

export function createSectionStarsInteraction(
  stars: readonly SectionStar[] | (() => readonly SectionStar[])
) {
  const getStars = typeof stars === 'function' ? stars : () => stars;
  const nearStarIds = signal<ReadonlySet<number>>(new Set());

  let rafId = 0;
  let pendingEvent: MouseEvent | null = null;
  let sectionEl: HTMLElement | null = null;
  let intersectionObserver: IntersectionObserver | null = null;
  let lastClientX = 0;
  let lastClientY = 0;

  function isSectionVisible(): boolean {
    if (!sectionEl) {
      return false;
    }

    const binding = boundSections.get(sectionEl);
    return Boolean(binding?.isIntersecting && !isScrolling);
  }

  function clearNearStars(): void {
    if (nearStarIds().size === 0) {
      return;
    }

    nearStarIds.set(new Set());
  }

  function flushPointerUpdate(): void {
    rafId = 0;
    const event = pendingEvent;
    pendingEvent = null;

    if (!event || !sectionEl || isScrolling) {
      return;
    }

    const rect = sectionEl.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return;
    }

    const nextNear = getNearStarIds(getStars(), rect, event.clientX, event.clientY);
    const currentNear = nearStarIds();

    if (nextNear.size !== currentNear.size) {
      nearStarIds.set(nextNear);
      return;
    }

    for (const id of nextNear) {
      if (!currentNear.has(id)) {
        nearStarIds.set(nextNear);
        return;
      }
    }
  }

  function onPointerMove(event: MouseEvent): void {
    if (!HOVER_CAPABLE || !isSectionVisible()) {
      return;
    }

    const dx = event.clientX - lastClientX;
    const dy = event.clientY - lastClientY;
    if (dx * dx + dy * dy < POINTER_MOVE_EPSILON_SQ) {
      return;
    }

    lastClientX = event.clientX;
    lastClientY = event.clientY;
    pendingEvent = event;

    if (rafId !== 0) {
      return;
    }

    rafId = requestAnimationFrame(flushPointerUpdate);
  }

  function onPointerLeave(): void {
    pendingEvent = null;
    lastClientX = 0;
    lastClientY = 0;

    if (rafId !== 0) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }

    clearNearStars();
  }

  function attach(section: HTMLElement): void {
    if (sectionEl === section) {
      return;
    }

    destroyObservers();
    sectionEl = section;
    scrollClearCallbacks.add(clearNearStars);
    registerScrollPause(section);

    if (typeof IntersectionObserver !== 'undefined') {
      intersectionObserver = new IntersectionObserver(
        ([entry]) => {
          setSectionIntersecting(section, entry.isIntersecting);
          if (!entry.isIntersecting) {
            clearNearStars();
          }
        },
        { rootMargin: '15% 0px', threshold: 0 }
      );
      intersectionObserver.observe(section);
    }
  }

  function destroyObservers(): void {
    pendingEvent = null;
    if (rafId !== 0) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }

    if (sectionEl) {
      scrollClearCallbacks.delete(clearNearStars);
      unregisterScrollPause(sectionEl);
    }

    intersectionObserver?.disconnect();
    intersectionObserver = null;
    sectionEl = null;
  }

  function destroy(): void {
    destroyObservers();
    nearStarIds.set(new Set());
    lastClientX = 0;
    lastClientY = 0;
  }

  return {
    nearStarIds,
    attach,
    onPointerMove,
    onPointerLeave,
    destroy,
  };
}
