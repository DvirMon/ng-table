import { signal, type ResourceRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { columnSchema } from '../../columns-schema/schema';
import { createColumnMetaKey, metadata, readColumnMeta } from '../../columns-schema/metadata';
import { applyVisible, applyVisibleAsync } from '../../columns-schema/rules';
import { createTable } from '../../api/create-table';
import { reorderColumns, setColumns, toggleColumnVisibility } from '../../mutations/update-columns';
import type { ColumnDef, TableConfig, TableStore } from '../../api/types';

interface Row {
  id: string;
  name: string;
  status: string;
}

// No `ColumnDef<Row>[]` return annotation — that would widen `id` to `string` and turn
// `ColumnsPath` into an index signature (ADR-0019).
function makeColumns() {
  return [
    {
      id: 'name' as const,
      accessor: (row: Row) => row.name,
      visible: true,
      order: 0,
      label: 'name',
    },
    {
      id: 'status' as const,
      accessor: (row: Row) => row.status,
      visible: true,
      order: 1,
      label: 'status',
    },
  ] satisfies ColumnDef<Row>[];
}

// Mirrors `table.store.spec.ts` / `with-sorting.spec.ts` — builds a live store instance inside
// an injection context. Generic over `TId` (not fixed to `TableConfig<Row>`'s default `string`)
// so a caller's literal `columns` still contextually types its `columnsSchema` callback, and the
// returned store now carries that same `TId` (#113).
function makeStore<TId extends string = string>(cfg: TableConfig<Row, TId>): TableStore<Row, TId> {
  return TestBed.runInInjectionContext(() =>
    createTable(signal<Row[]>([]), cfg)
  );
}

/**
 * Minimal controllable `ResourceRef` test double — only the subset
 * `wire-columns-schema.ts`'s async wiring actually reads (`status`,
 * `value`, `error`). The rest of the real `ResourceRef` interface
 * (`hasValue`, `set`, `reload`, ...) is never touched by that code path, so
 * it's cast rather than fully implemented.
 */
function makeControllableResource<TResult>(): {
  resourceRef: ResourceRef<TResult | undefined>;
  resolve(value: TResult): void;
  reject(error: unknown): void;
  setLoading(): void;
} {
  const value = signal<TResult | undefined>(undefined);
  const status = signal<'idle' | 'loading' | 'resolved' | 'error'>('idle');
  const error = signal<unknown>(undefined);

  const resourceRef = {
    value,
    status,
    error,
  } as unknown as ResourceRef<TResult | undefined>;

  return {
    resourceRef,
    resolve(next: TResult): void {
      value.set(next);
      status.set('resolved');
    },
    reject(nextError: unknown): void {
      error.set(nextError);
      status.set('error');
    },
    setLoading(): void {
      status.set('loading');
    },
  };
}

describe('wireColumnsSchemaAsync (via createTable columnsSchema wiring)', () => {
  it('is a zero-cost no-op when no columnsSchema is configured (legacy path)', () => {
    const store = makeStore({ trackBy: 'id', columns: makeColumns() });

    TestBed.tick();

    expect(store.columns().find((c) => c.id === 'status')?.visible).toBe(true);
  });

  it('applies a reactive applyVisible rule when its signal changes', () => {
    const role = signal<'admin' | 'guest'>('guest');
    const store = makeStore({
      trackBy: 'id',
      columns: makeColumns(),
      columnsSchema: (path) => {
        applyVisible(path.status, { when: () => role() === 'admin' });
      },
    });

    TestBed.tick();
    expect(store.columns().find((c) => c.id === 'status')?.visible).toBe(false);

    role.set('admin');
    TestBed.tick();
    expect(store.columns().find((c) => c.id === 'status')?.visible).toBe(true);
  });

  it('combines multiple applyVisible rules on the same column via the `and` reducer', () => {
    const hasPermission = signal(true);
    const isFeatureEnabled = signal(true);
    const store = makeStore({
      trackBy: 'id',
      columns: makeColumns(),
      columnsSchema: (path) => {
        applyVisible(path.status, { when: () => hasPermission() });
        applyVisible(path.status, { when: () => isFeatureEnabled() });
      },
    });

    TestBed.tick();
    expect(store.columns().find((c) => c.id === 'status')?.visible).toBe(true);

    isFeatureEnabled.set(false);
    TestBed.tick();
    expect(store.columns().find((c) => c.id === 'status')?.visible).toBe(false);

    isFeatureEnabled.set(true);
    TestBed.tick();
    expect(store.columns().find((c) => c.id === 'status')?.visible).toBe(true);
  });

  it('accepts a standalone columnSchema() value identically to an inline schemaFn', () => {
    const sharedSchema = columnSchema<Row, 'name' | 'status'>((path) => {
      applyVisible(path.status, { when: () => false });
    });
    const store = makeStore({
      trackBy: 'id',
      columns: makeColumns(),
      columnsSchema: sharedSchema,
    });

    TestBed.tick();
    expect(store.columns().find((c) => c.id === 'status')?.visible).toBe(
      false
    );
  });

  it('applyVisibleAsync sets visible via onSuccess when the resource resolves', () => {
    const control = makeControllableResource<boolean>();
    const store = makeStore({
      trackBy: 'id',
      columns: makeColumns(),
      columnsSchema: (path) => {
        applyVisibleAsync(path.status, {
          params: () => 'role',
          factory: (): ResourceRef<boolean | undefined> => control.resourceRef,
          onSuccess: (result) => result,
          onError: () => false,
        });
      },
    });

    TestBed.tick();
    // Still idle — no patch yet, column keeps its seeded `visible: true`.
    expect(store.columns().find((c) => c.id === 'status')?.visible).toBe(true);

    control.resolve(false);
    TestBed.tick();
    expect(store.columns().find((c) => c.id === 'status')?.visible).toBe(false);
  });

  it('applyVisibleAsync applies onError on failure when provided', () => {
    const control = makeControllableResource<boolean>();
    const store = makeStore({
      trackBy: 'id',
      columns: makeColumns(),
      columnsSchema: (path) => {
        applyVisibleAsync(path.status, {
          params: () => 'role',
          factory: (): ResourceRef<boolean | undefined> => control.resourceRef,
          onSuccess: (result) => result,
          onError: () => false,
        });
      },
    });

    control.resolve(true);
    TestBed.tick();
    expect(store.columns().find((c) => c.id === 'status')?.visible).toBe(true);

    control.reject(new Error('boom'));
    TestBed.tick();
    expect(store.columns().find((c) => c.id === 'status')?.visible).toBe(false);
  });

  it('applyVisibleAsync applies onError again on a second consecutive failure', () => {
    // `onError` is now required (D5/D11) — the old "no onError" case is impossible to construct.
    // This replaces it, asserting the *with*-onError behavior stays correct across repeated
    // error/success cycles rather than just the single resolve-then-reject the existing
    // "applies onError on failure when provided" case already covers.
    const control = makeControllableResource<boolean>();
    const store = makeStore({
      trackBy: 'id',
      columns: makeColumns(),
      columnsSchema: (path) => {
        applyVisibleAsync(path.status, {
          params: () => 'role',
          factory: (): ResourceRef<boolean | undefined> => control.resourceRef,
          onSuccess: (result) => result,
          onError: () => false,
        });
      },
    });

    control.reject(new Error('first'));
    TestBed.tick();
    expect(store.columns().find((c) => c.id === 'status')?.visible).toBe(false);

    control.resolve(true);
    TestBed.tick();
    expect(store.columns().find((c) => c.id === 'status')?.visible).toBe(true);

    control.reject(new Error('second'));
    TestBed.tick();
    expect(store.columns().find((c) => c.id === 'status')?.visible).toBe(false);
  });

  it('D2: an imperative visibility toggle loses to a rule governing the same column', () => {
    const store = makeStore({
      trackBy: 'id',
      columns: makeColumns(),
      columnsSchema: (path) => {
        applyVisible(path.status, { when: () => true });
      },
    });

    TestBed.tick();
    expect(store.columns().find((c) => c.id === 'status')?.visible).toBe(true);

    store.columns.update(toggleColumnVisibility('status'));
    TestBed.tick();

    // Rule still says visible — the imperative toggle is overridden, not applied.
    expect(store.columns().find((c) => c.id === 'status')?.visible).toBe(true);
  });

  it('D2: an imperative reorder and an unruled toggle survive an unrelated rule re-evaluating', () => {
    const role = signal<'admin' | 'guest'>('guest');
    const store = makeStore({
      trackBy: 'id',
      columns: makeColumns(),
      columnsSchema: (path) => {
        applyVisible(path.status, { when: () => role() === 'admin' });
      },
    });

    TestBed.tick();

    store.columns.update(reorderColumns(['status', 'name']));
    store.columns.update(toggleColumnVisibility('name'));
    TestBed.tick();

    expect(store.columns().find((c) => c.id === 'status')?.order).toBe(0);
    expect(store.columns().find((c) => c.id === 'name')?.order).toBe(1);
    expect(store.columns().find((c) => c.id === 'name')?.visible).toBe(false);

    // Re-evaluate the rule on `status` — an unrelated column — by flipping its dependency.
    role.set('admin');
    TestBed.tick();

    // The reorder and the unruled toggle on `name` both survived the rule re-evaluating.
    expect(store.columns().find((c) => c.id === 'status')?.order).toBe(0);
    expect(store.columns().find((c) => c.id === 'name')?.order).toBe(1);
    expect(store.columns().find((c) => c.id === 'name')?.visible).toBe(false);
    expect(store.columns().find((c) => c.id === 'status')?.visible).toBe(true);
  });

  it("D9: replacing the column list leaves a dropped column's rule inert, and the rule reactivates once its column rejoins the list", () => {
    // `resolveColumnsConfig` validates every rule's `columnId` against the *construction-time*
    // `columns` array and throws synchronously for an unknown id (`resolve.ts`,
    // `assertRuleColumnIdsAreKnown`) — a rule cannot be declared for a column that has never
    // existed. So "a rule applies on a newly added column" (D9 / user story 13) is exercised
    // here as: the column exists at construction (satisfying that eager check), a later
    // `setColumns` call drops it from the *active* list (rule goes inert, no error), and a
    // further `setColumns` call re-adds it by the same id (rule re-applies with no
    // re-registration) — which is what D9's fold-time id lookup actually provides.
    const initialColumns = [
      ...makeColumns(),
      {
        id: 'id' as const,
        accessor: (row: Row) => row.id,
        visible: false,
        order: 2,
        label: 'id',
      },
    ] satisfies ColumnDef<Row>[];

    const store = makeStore({
      trackBy: 'id',
      columns: initialColumns,
      columnsSchema: (path) => {
        applyVisible(path.name, { when: () => false });
        applyVisible(path.id, { when: () => true });
      },
    });

    TestBed.tick();
    expect(store.columns().find((c) => c.id === 'name')?.visible).toBe(false);
    expect(store.columns().find((c) => c.id === 'id')?.visible).toBe(true);

    expect(() => {
      // `TId` explicit: the array itself only names a subset of the declared ids —
      // dropping/re-adding columns is this test's whole point — so it can't be inferred
      // from the argument the way `makeColumns()`'s call sites can (#113).
      store.columns.update(
        setColumns<Row, 'name' | 'status' | 'id'>([{ id: 'status', visible: true }])
      );
      TestBed.tick();
    }).not.toThrow();

    // Both rule-governed columns are simply gone — their rules are inert, not errors.
    expect(store.columns().find((c) => c.id === 'name')).toBeUndefined();
    expect(store.columns().find((c) => c.id === 'id')).toBeUndefined();

    // `id` rejoins the list — its rule picks back up on the next evaluation, no re-registration.
    store.columns.update(
      setColumns<Row, 'name' | 'status' | 'id'>([
        { id: 'status', visible: true },
        { id: 'id', accessor: (row: Row) => row.id, visible: false },
      ])
    );
    TestBed.tick();

    expect(store.columns().find((c) => c.id === 'id')?.visible).toBe(true);
  });

  it('D5: an async rule holds its previously resolved value while a second fetch is in flight', () => {
    const control = makeControllableResource<boolean>();
    const store = makeStore({
      trackBy: 'id',
      columns: makeColumns(),
      columnsSchema: (path) => {
        applyVisibleAsync(path.status, {
          params: () => 'role',
          factory: (): ResourceRef<boolean | undefined> => control.resourceRef,
          onSuccess: (result) => result,
          onError: () => false,
        });
      },
    });

    control.resolve(false);
    TestBed.tick();
    expect(store.columns().find((c) => c.id === 'status')?.visible).toBe(false);

    // Trigger a second in-flight fetch — `status` goes back to `loading` without a resolved
    // value yet.
    control.setLoading();
    TestBed.tick();

    // Still the previously resolved value — not a reset to the declared default (`true`).
    expect(store.columns().find((c) => c.id === 'status')?.visible).toBe(false);

    control.resolve(true);
    TestBed.tick();
    expect(store.columns().find((c) => c.id === 'status')?.visible).toBe(true);
  });

  it('D8: a rule reading ctx.columns() resolves against base state, never its own rule result', () => {
    const store = makeStore({
      trackBy: 'id',
      columns: makeColumns(),
      columnsSchema: (path) => {
        // Would form a cycle if `ctx.columns()` resolved to the derived `columns` (which this
        // very rule contributes to) instead of `baseColumns`.
        applyVisible(path.status, {
          when: (ctx) =>
            !(ctx.columns().find((c) => c.id === 'status')?.visible ?? true),
        });
      },
    });

    expect(() => TestBed.tick()).not.toThrow();
    // `status.visible` is declared `true` in `makeColumns()` and the base never changes, so the
    // rule's inverted read is stable at `false`. If `ctx.columns()` resolved to the derived
    // signal instead, this would either flip on every read or blow the stack/hang — not settle.
    expect(store.columns().find((c) => c.id === 'status')?.visible).toBe(false);

    expect(() => {
      TestBed.tick();
      TestBed.tick();
      TestBed.tick();
    }).not.toThrow();
    expect(store.columns().find((c) => c.id === 'status')?.visible).toBe(false);
  });

  it('throws synchronously at store construction for an unknown columnId', () => {
    expect(() =>
      TestBed.runInInjectionContext(() =>
        createTable(signal<Row[]>([]), {
          trackBy: 'id',
          columns: makeColumns(),
          columnsSchema: (path) => {
            // `missing` isn't `keyof Row` — cast to force the runtime path
            // resolveColumnsConfig()'s unknown-columnId check guards.
            applyVisible(
              (path as unknown as { missing: (typeof path)['name'] }).missing,
              { when: () => true }
            );
          },
        })
      )
    ).toThrow(/Unknown column id "missing"/);
  });
});

describe('metadata() (via createTable columnsSchema wiring)', () => {
  it('resolves a static value onto the matching column', () => {
    const KEY = createColumnMetaKey<string>();
    const store = makeStore({
      trackBy: 'id',
      columns: makeColumns(),
      columnsSchema: (path) => {
        metadata(path.status, KEY, 'admin-only');
      },
    });

    TestBed.tick();
    const status = store.columns().find((c) => c.id === 'status');
    expect(readColumnMeta(status as never, KEY)).toBe('admin-only');
  });

  it('resolves a reactive closure and updates when its signal changes', () => {
    const KEY = createColumnMetaKey<string>();
    const role = signal<'admin' | 'guest'>('guest');
    const store = makeStore({
      trackBy: 'id',
      columns: makeColumns(),
      columnsSchema: (path) => {
        metadata(path.status, KEY, () =>
          role() === 'admin' ? 'full-access' : 'read-only'
        );
      },
    });

    TestBed.tick();
    expect(
      readColumnMeta(store.columns().find((c) => c.id === 'status') as never, KEY)
    ).toBe('read-only');

    role.set('admin');
    TestBed.tick();
    expect(
      readColumnMeta(store.columns().find((c) => c.id === 'status') as never, KEY)
    ).toBe('full-access');
  });

  it('leaves an unrelated column untouched', () => {
    const KEY = createColumnMetaKey<string>();
    const store = makeStore({
      trackBy: 'id',
      columns: makeColumns(),
      columnsSchema: (path) => {
        metadata(path.status, KEY, 'x');
      },
    });

    TestBed.tick();
    const name = store.columns().find((c) => c.id === 'name');
    expect(readColumnMeta(name as never, KEY)).toBeUndefined();
  });

  it('throws synchronously at store construction on a duplicate (column, key) registration', () => {
    const KEY = createColumnMetaKey<string>();

    expect(() =>
      TestBed.runInInjectionContext(() =>
        createTable(signal<Row[]>([]), {
          trackBy: 'id',
          columns: makeColumns(),
          columnsSchema: (path) => {
            metadata(path.status, KEY, 'a');
            metadata(path.status, KEY, 'b');
          },
        })
      )
    ).toThrow(/Duplicate metadata\(\) registration/);
  });
});
