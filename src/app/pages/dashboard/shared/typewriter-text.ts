export function createTypewriter(
  fullText: string,
  onUpdate: (partial: string) => void,
  onComplete: () => void,
  options: { intervalMs?: number } = {}
): () => void {
  const baseMs = options.intervalMs ?? 42;
  let index = 0;
  let timerId = 0;
  let cancelled = false;

  if (prefersReducedMotion()) {
    timerId = window.setTimeout(() => {
      if (cancelled) {
        return;
      }

      onUpdate(fullText);
      onComplete();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }

  const tick = (): void => {
    if (cancelled) {
      return;
    }

    index += 1;
    const partial = fullText.slice(0, index);
    onUpdate(partial);

    if (index >= fullText.length) {
      onComplete();
      return;
    }

    timerId = window.setTimeout(tick, typewriterDelayFor(fullText[index - 1] ?? '', baseMs));
  };

  onUpdate('');
  timerId = window.setTimeout(tick, baseMs);

  return () => {
    cancelled = true;
    window.clearTimeout(timerId);
  };
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

function typewriterDelayFor(char: string, baseMs: number): number {
  if (char === '\n') {
    return baseMs * 5;
  }

  if (/[.!?]/.test(char)) {
    return baseMs * 3.5;
  }

  if (/[,;:]/.test(char)) {
    return baseMs * 2;
  }

  return baseMs;
}
