// Angular's global dev-mode flag. Declared locally because `tsconfig.lib.json` sets
// `"types": []`, so no ambient declaration is in scope. Module-scoped, so it cannot
// collide with another file's declaration.
declare const ngDevMode: boolean | undefined;

/**
 * Throws when an id doesn't name a known column.
 *
 * @remarks
 * Never gated by `ngDevMode` — these ids arrive only at runtime (a user
 * write, a replayed saved layout), so gating this copy would let a bad
 * write reach production silently.
 *
 * @param label Names the declaring surface in the thrown message.
 */
export function assertWrittenIdsAreKnown(
  ids: Iterable<string>,
  knownIds: Iterable<string>,
  label: string,
): void {
  const known = new Set(knownIds);
  for (const id of ids) {
    if (!known.has(id)) {
      throw new Error(`[${label}] Unknown column id "${id}" — no declared column has this id.`);
    }
  }
}

/**
 * Construction-time check that every declared id names a known column.
 * Deterministic — fires before any data flows, so it throws.
 *
 * @remarks
 * Dev-only: stripped from production builds.
 *
 * @param label Names the declaring surface in the thrown message.
 */
export function assertDeclarationsAreKnown(
  declaredIds: Iterable<string>,
  knownIds: Iterable<string>,
  label: string,
): void {
  if (typeof ngDevMode === 'undefined' || ngDevMode) {
    assertWrittenIdsAreKnown(declaredIds, knownIds, label);
  }
}
