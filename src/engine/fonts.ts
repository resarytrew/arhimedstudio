let promise: Promise<void> | null = null;

/** Make sure fonts used by the canvas renderer are loaded (incl. Cyrillic subsets). */
export function loadEngineFonts(): Promise<void> {
  if (!promise) {
    const sample = "Привет Hello 123 αβπ";
    const loads = [
      document.fonts.load('48px "PT Serif"', sample),
      document.fonts.load('500 48px "Manrope"', sample),
    ].map((p) => p.catch(() => undefined));
    const timeout = new Promise<void>((r) => setTimeout(r, 3000));
    promise = Promise.race([Promise.all(loads).then(() => document.fonts.ready).then(() => undefined), timeout]);
  }
  return promise;
}
