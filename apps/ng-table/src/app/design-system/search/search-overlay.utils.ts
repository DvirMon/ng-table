/** Wraps `index` into `[0, length)`. Returns 0 when `length` is 0. */
export function wrapIndex(index: number, length: number): number {
  if (length <= 0) {
    return 0;
  }
  return ((index % length) + length) % length;
}
