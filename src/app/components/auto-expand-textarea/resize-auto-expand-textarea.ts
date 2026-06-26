export type AutoExpandTextareaResizeOptions = {
  pillRadius?: boolean;
  singleLineHeight?: number;
  minRadiusPx?: number;
};

export function resizeAutoExpandTextarea(
  textarea: HTMLTextAreaElement,
  value?: string,
  options: AutoExpandTextareaResizeOptions = {},
): void {
  const { pillRadius = false, singleLineHeight = 44, minRadiusPx = 10 } = options;

  if (value !== undefined && textarea.value !== value) {
    textarea.value = value;
  }

  const computedMinHeight = Number.parseFloat(getComputedStyle(textarea).minHeight) || 0;

  textarea.style.height = '1px';
  const height = Math.max(textarea.scrollHeight, computedMinHeight);
  textarea.style.height = `${height}px`;

  if (pillRadius) {
    const pillRadiusValue = singleLineHeight / 2;
    const extra = Math.max(0, height - singleLineHeight);
    const radiusPx = Math.max(minRadiusPx, pillRadiusValue - extra * 0.22);
    textarea.style.borderRadius = `${radiusPx}px`;
  }
}

export function scheduleAutoExpandTextareaLayout(
  getTextarea: () => HTMLTextAreaElement | undefined,
  value: () => string,
  options: AutoExpandTextareaResizeOptions & { focus?: boolean } = {},
): void {
  queueMicrotask(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const textarea = getTextarea();
        if (!textarea) {
          return;
        }

        resizeAutoExpandTextarea(textarea, value(), options);

        if (options.focus) {
          textarea.focus({ preventScroll: true });
        }
      });
    });
  });
}
