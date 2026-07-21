/**
 * iOS Safari never leaves "keyboard mode" when the focused input is removed
 * from the DOM without a blur — the layout viewport stays shrunk by the
 * keyboard's height, so every position:fixed element (the bottom nav) floats
 * mid-screen with page background bleeding below it, and client-side
 * navigation carries the broken viewport to every subsequent screen.
 *
 * Call this at the start of any submit handler whose success path unmounts
 * the form (router.push, conditional swap to a success card).
 */
export function dismissKeyboard(): void {
  if (typeof document === "undefined") return;
  const active = document.activeElement;
  if (active instanceof HTMLElement) {
    active.blur();
  }
}
