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

  const onClick = (): void => {
    onClose();
  };

  el.addEventListener('click', onClick);
  document.body.appendChild(el);

  return () => {
    el.removeEventListener('click', onClick);
    el.remove();
  };
}
