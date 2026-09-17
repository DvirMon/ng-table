/** `1400ms` / `1.4s` / `0.25S` — the two CSS `<time>` units, optional sign stripped by the guard. */
const CSS_TIME_PATTERN = /^(\d*\.?\d+)(ms|s)$/i;

/**
 * Parses a CSS `<time>` value into milliseconds. Returns `undefined` for anything unparseable —
 * including the empty string `getComputedStyle().getPropertyValue()` yields for a custom property
 * that is not defined (no stylesheet loaded, jsdom without the token file, SSR).
 */
export function parseCssDurationMs(value: string): number | undefined {
  const match = CSS_TIME_PATTERN.exec(value.trim());
  if (match === null) {
    return undefined;
  }

  const [, amount, unit] = match;
  const parsed = Number.parseFloat(amount);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return unit.toLowerCase() === 's' ? parsed * 1000 : parsed;
}
