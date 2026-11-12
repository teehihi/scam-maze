// Small focus helpers for the Chapter_Page overlays (Requirements 17.2, 17.3).
// Plain DOM code with no React, so the page can use it from its window key handler.

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/** Elements inside `container` that Tab can reach, in document order. */
export function getTabbable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.closest("[hidden], [inert]"),
  );
}

/** The top-most modal dialog inside `layer` (overlays render bottom first), or `null`. */
export function topDialog(layer: HTMLElement | null): HTMLElement | null {
  if (!layer) return null;
  const dialogs = layer.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]');
  return dialogs.length > 0 ? dialogs[dialogs.length - 1] : null;
}

/**
 * Moves focus to a sensible start inside `dialog`: its programmatically focusable heading, else
 * the first tabbable element.
 */
export function focusDialogStart(dialog: HTMLElement): void {
  const target = dialog.querySelector<HTMLElement>('h1[tabindex="-1"], h2[tabindex="-1"]') ?? getTabbable(dialog)[0];
  target?.focus({ preventScroll: true });
}

/**
 * Keeps Tab and Shift+Tab inside `dialog`: focus wraps from the last tabbable element to the
 * first and back, and focus outside the dialog is pulled in. Call it for a Tab keydown.
 */
export function trapTabKey(dialog: HTMLElement, event: KeyboardEvent): void {
  const items = getTabbable(dialog);
  if (items.length === 0) {
    event.preventDefault();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;

  if (!(active instanceof HTMLElement) || !dialog.contains(active)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
    return;
  }

  if (event.shiftKey) {
    // From the first item, or from a non-tabbable element (a heading) before every item.
    const nothingBefore = !items.some(
      (item) => item !== active && item.compareDocumentPosition(active) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
    if (active === first || nothingBefore) {
      event.preventDefault();
      last.focus();
    }
  } else {
    const nothingAfter = !items.some(
      (item) => item !== active && active.compareDocumentPosition(item) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
    if (active === last || nothingAfter) {
      event.preventDefault();
      first.focus();
    }
  }
}
