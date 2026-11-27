/** One styled run of text on a code line. `color` is absent for unhighlighted text. */
export interface CodeToken {
  readonly content: string;
  readonly color?: string;
}
