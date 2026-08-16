import {
  drawerAnimationDuration,
  drawerMotionDelay,
} from './drawer-motion';

export function mountDrawerBodyBackdrop(
  label: string,
  onClose: () => void,
): () => void {
  if (typeof document === 'undefined') {
    return () => undefined;
  }

  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'drawer-body-backdrop';
  el.setAttribute('aria-label', label);
  el.style.opacity = '0';
  let closing = false;
  let animation: Animation | null = null;

  const onClick = (): void => {
    onClose();
  };

  el.addEventListener('click', onClick);
  document.body.appendChild(el);
  animation = el.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: drawerAnimationDuration(),
    easing: 'ease',
    fill: 'forwards',
  });

  return () => {
    if (closing) {
      return;
    }
    closing = true;
    el.removeEventListener('click', onClick);
    const currentOpacity = getComputedStyle(el).opacity;
    animation?.cancel();
    animation = el.animate([{ opacity: currentOpacity }, { opacity: 0 }], {
      duration: drawerAnimationDuration(),
      easing: 'ease',
      fill: 'forwards',
    });

    window.setTimeout(() => el.remove(), drawerMotionDelay());
  };
}
