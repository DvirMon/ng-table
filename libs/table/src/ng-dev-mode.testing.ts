/**
 * Shared test-only toggle for Angular's global dev-mode flag. `engine/columns.ts`,
 * `engine/stage-order.ts`, `engine/slots.ts`, `api/create-columns.ts` and `schema/validate.ts`
 * each read the bare identifier `ngDevMode`,
 * which resolves through the global object at runtime. `@angular/core` already
 * ambient-declares `ngDevMode` as `const`, so it can't be redeclared with `var` to surface it
 * on `globalThis`'s type — this narrow, test-local cast is the only way to flip the flag
 * without editing the ambient declaration.
 *
 * Colocated at `src/` root (like `table.mock.ts`) because it's shared across `api/` and
 * `engine/` spec files, not owned by either.
 */
export function getNgDevMode(): boolean | undefined {
  return (globalThis as Record<string, unknown>)['ngDevMode'] as boolean | undefined;
}

export function setNgDevMode(value: boolean | undefined): void {
  (globalThis as Record<string, unknown>)['ngDevMode'] = value;
}
