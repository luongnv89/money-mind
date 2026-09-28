import { useEffect, useRef, type MouseEvent } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

const focusableIn = (panel: HTMLElement): HTMLElement[] =>
  Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden')
  );

/**
 * Modal dialog behavior (APG dialog pattern / WCAG 2.4.3, 4.1.2):
 * moves focus to the first control inside the panel on open, traps Tab
 * within it, closes on Escape, and restores focus to the invoking element
 * on close. Attach the returned ref to the dialog panel (which should also
 * carry role="dialog" aria-modal="true" and tabIndex={-1}).
 */
export const useDialog = <T extends HTMLElement = HTMLDivElement>(
  isOpen: boolean,
  onClose: () => void
) => {
  const panelRef = useRef<T>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) return;
    const panel = panelRef.current;
    if (!panel) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    (focusableIn(panel)[0] ?? panel).focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusableIn(panel);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const focusOutside = !panel.contains(active);
      if (e.shiftKey && (active === first || focusOutside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || focusOutside)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [isOpen]);

  return panelRef;
};

/** Backdrop-click handler: fires onClose only when the overlay itself is the target. */
export const closeOnBackdrop = (onClose: () => void) => (e: MouseEvent<HTMLElement>) => {
  if (e.target === e.currentTarget) onClose();
};
