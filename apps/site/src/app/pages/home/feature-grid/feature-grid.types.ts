/**
 * One cell in Home's six-cell feature grid: an icon, a title, and a one-line description. Not an
 * input any more — the consumer authors each `<article>` — but kept as the typed shape
 * `pages/home/home.content.ts` uses for the six authored cells.
 */
export interface FeatureCell {
  /** Lucide icon component name (e.g. `'lucideTable'`), registered locally via `provideIcons`. */
  readonly icon: string;
  readonly title: string;
  readonly description: string;
}
