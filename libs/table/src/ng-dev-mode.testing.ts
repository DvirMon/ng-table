// Shared by `api/` and `engine/` specs, so it lives at `src/` root like `table.mock.ts`.

/** Reads Angular's global `ngDevMode` flag, for specs that save and restore it. */
export function getNgDevMode(): boolean | undefined {
  // Note: `@angular/core` ambient-declares `ngDevMode` as `const`, so it can't be redeclared
  // with `var` to appear on `globalThis`'s type. This test-local cast is the only way through.
  return (globalThis as Record<string, unknown>)['ngDevMode'] as boolean | undefined;
}

/** Sets Angular's global `ngDevMode` flag, which dev-gated construction checks read at runtime. */
export function setNgDevMode(value: boolean | undefined): void {
  (globalThis as Record<string, unknown>)['ngDevMode'] = value;
}
