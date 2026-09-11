import {
  assertFilterPathIsCurrent,
  buildFiltersPath,
  createFilterRecorderSession,
  currentFilterRecorder,
  withActiveFilterRecorder,
} from './recorder';
import type {
  FilterHandle,
  FilterOptions,
  FilterRuleRecord,
  FilterValueOfContext,
  FiltersPath,
} from '../filters.types';
import {
  hasAnyOf,
  hasNoneOf,
  isContaining,
  isEqual,
  isInDateRange,
  isInRange,
} from './matchers';

/**
 * The declaration rules a consumer calls inside a `createFilters()` schema body. Bare verbs
 * (`equals`, `contains`, …) — they *do* something (register a filter) — as opposed to the
 * boolean-guard-prefixed matchers (`isEqual`, `isContaining`, …) they default to, which
 * *return* something (R30).
 *
 * Every rule erases its matcher/criterion generics to `FilterRuleRecord<TRow>`'s `unknown`
 * storage shape via `as` — the same generic-erasure boundary `schema/column-schema.ts`'s
 * `createRecorderSession` documents: the erased type only ever round-trips through the record's
 * own `key`/`paths` at read time (`create-filters.ts`), never re-derived structurally, so
 * collapsing to `unknown` here is sound even though TS can't prove it at this storage step.
 */

type RangeCriterion = { min: number | null; max: number | null };
type DateRangeCriterion = { from: Date | null; to: Date | null };

function isEmptyRange(criterion: RangeCriterion): boolean {
  return criterion.min == null && criterion.max == null;
}

function isEmptyDateRange(criterion: DateRangeCriterion): boolean {
  return criterion.from == null && criterion.to == null;
}

export function equals<TRow, K extends Extract<keyof TRow, string>>(
  path: FilterHandle<TRow, K>,
  options?: FilterOptions<TRow[K]>
): void {
  const recorder = assertFilterPathIsCurrent(path);
  recorder.record({
    kind: 'single',
    paths: [path.id],
    key: options?.as ?? path.id,
    predicate: isEqual as (cell: unknown, criterion: unknown) => boolean,
    isEmpty: (v: unknown) => v == null,
    emptyValue: null,
    options: options as FilterOptions<unknown> | undefined,
  } satisfies FilterRuleRecord<TRow>);
}

export function contains<TRow, K extends Extract<keyof TRow, string>>(
  path: FilterHandle<TRow, K>,
  options?: FilterOptions<string>
): void {
  const recorder = assertFilterPathIsCurrent(path);
  recorder.record({
    kind: 'single',
    paths: [path.id],
    key: options?.as ?? path.id,
    predicate: isContaining as (cell: unknown, criterion: unknown) => boolean,
    isEmpty: (v: unknown) => v === '',
    emptyValue: '',
    options: options as FilterOptions<unknown> | undefined,
  } satisfies FilterRuleRecord<TRow>);
}

export function inRange<TRow, K extends Extract<keyof TRow, string>>(
  path: FilterHandle<TRow, K>,
  options?: FilterOptions<RangeCriterion>
): void {
  const recorder = assertFilterPathIsCurrent(path);
  recorder.record({
    kind: 'single',
    paths: [path.id],
    key: options?.as ?? path.id,
    predicate: isInRange as unknown as (cell: unknown, criterion: unknown) => boolean,
    isEmpty: (v: unknown) => isEmptyRange(v as RangeCriterion),
    emptyValue: { min: null, max: null } as RangeCriterion,
    options: options as FilterOptions<unknown> | undefined,
  } satisfies FilterRuleRecord<TRow>);
}

export function inDateRange<TRow, K extends Extract<keyof TRow, string>>(
  path: FilterHandle<TRow, K>,
  options?: FilterOptions<DateRangeCriterion>
): void {
  const recorder = assertFilterPathIsCurrent(path);
  recorder.record({
    kind: 'single',
    paths: [path.id],
    key: options?.as ?? path.id,
    predicate: isInDateRange as unknown as (cell: unknown, criterion: unknown) => boolean,
    isEmpty: (v: unknown) => isEmptyDateRange(v as DateRangeCriterion),
    emptyValue: { from: null, to: null } as DateRangeCriterion,
    options: options as FilterOptions<unknown> | undefined,
  } satisfies FilterRuleRecord<TRow>);
}

export function hasAny<TRow, K extends Extract<keyof TRow, string>>(
  path: FilterHandle<TRow, K>,
  options?: FilterOptions<readonly unknown[]>
): void {
  const recorder = assertFilterPathIsCurrent(path);
  recorder.record({
    kind: 'single',
    paths: [path.id],
    key: options?.as ?? path.id,
    predicate: hasAnyOf as (cell: unknown, criterion: unknown) => boolean,
    isEmpty: (v: unknown) => Array.isArray(v) && v.length === 0,
    emptyValue: [] as readonly unknown[],
    options: options as FilterOptions<unknown> | undefined,
  } satisfies FilterRuleRecord<TRow>);
}

export function hasNone<TRow, K extends Extract<keyof TRow, string>>(
  path: FilterHandle<TRow, K>,
  options?: FilterOptions<readonly unknown[]>
): void {
  const recorder = assertFilterPathIsCurrent(path);
  recorder.record({
    kind: 'single',
    paths: [path.id],
    key: options?.as ?? path.id,
    predicate: hasNoneOf as (cell: unknown, criterion: unknown) => boolean,
    isEmpty: (v: unknown) => Array.isArray(v) && v.length === 0,
    emptyValue: [] as readonly unknown[],
    options: options as FilterOptions<unknown> | undefined,
  } satisfies FilterRuleRecord<TRow>);
}

/**
 * The general rule (R7) — a peer of the named ones, not a layer beneath them. Takes the
 * predicate directly; `filter()`'s cell arrives **unguarded** (R27) — no automatic null-check
 * is applied, unlike the named rules' shipped matchers, so a custom predicate can itself choose
 * to match nulls.
 *
 * Emptiness can't be inferred for an arbitrary criterion shape, so `options.isEmpty` /
 * `options.emptyValue` opt a `filter()` rule into the same skip-when-empty behavior the named
 * rules get for free. Omitting both means this filter is **never empty** — it always
 * participates once its `value` diverges from `undefined`... in practice meaning the
 * consumer's own default `value` (via `options.source`, or `undefined` with no source) is
 * evaluated on every pass. Documented here since `filters.md` leaves this choice unspecified.
 */
export function filter<TRow, K extends Extract<keyof TRow, string>, TCriterion>(
  path: FilterHandle<TRow, K>,
  predicate: (cell: TRow[K], criterion: TCriterion) => boolean,
  options?: FilterOptions<TCriterion> & {
    isEmpty?: (criterion: TCriterion) => boolean;
    emptyValue?: TCriterion;
  }
): void {
  const recorder = assertFilterPathIsCurrent(path);
  recorder.record({
    kind: 'single',
    paths: [path.id],
    key: options?.as ?? path.id,
    predicate: predicate as (cell: unknown, criterion: unknown) => boolean,
    isEmpty: (options?.isEmpty as ((v: unknown) => boolean) | undefined) ?? (() => false),
    emptyValue: options?.emptyValue as unknown,
    options: options as FilterOptions<unknown> | undefined,
  } satisfies FilterRuleRecord<TRow>);
}

/**
 * Groups sibling predicates under one shared key and one shared criterion, OR'd (R8, R9). The
 * key is positional — a group has no single path to borrow one from. Runs `schema` through its
 * own nested recorder session (mirroring `createFilters()`'s own top-level session) so its
 * rule calls land as private children rather than independent top-level filters, then folds
 * them into one `kind: 'group'` record pushed to the *outer* schema's recorder (recovered via
 * `currentFilterRecorder()` — `anyOf` itself carries no path/handle to get it from directly).
 *
 * The group's own `isEmpty`/`emptyValue` are borrowed from its first declared child — anyOf
 * groups are expected to share one criterion type (e.g. every child a string search box), so
 * the first child's definition serves the whole group.
 */
export function anyOf<TRow>(key: string, schema: (path: FiltersPath<TRow>) => void): void {
  const outerRecorder = currentFilterRecorder<TRow>();

  const session = createFilterRecorderSession<TRow>();
  const nestedPath = buildFiltersPath(session.recorder);
  withActiveFilterRecorder(session.recorder, () => schema(nestedPath));
  session.close();

  const children = session.records;
  if (children.length === 0) {
    throw new Error(`[createFilters] anyOf("${key}", …) declared no rules.`);
  }
  const [first] = children;

  outerRecorder.record({
    kind: 'group',
    key,
    paths: children.map((child) => child.paths[0]),
    predicate: first.predicate,
    isEmpty: first.isEmpty,
    emptyValue: first.emptyValue,
    children: children.map((child) => ({ path: child.paths[0], predicate: child.predicate })),
  } satisfies FilterRuleRecord<TRow>);
}

/**
 * Conditional activation (R15, taken from Signal Forms directly). `condition` reads other
 * filters' *current criterion values* through `valueOf` — never row data. The inner `schema`
 * may declare any number of rules; each becomes its own top-level record, re-tagged
 * `kind: 'conditional'` with the same shared `condition` attached, rather than one record
 * wrapping several — every gated rule shares the gate, none references the others.
 *
 * `path` isn't read internally — `condition` already closes over whichever path(s) it
 * references — but the parameter mirrors `filters.md`'s documented signature and anchors
 * `TRow` for inference at the call site.
 */
export function applyWhen<TRow>(
  path: FiltersPath<TRow>,
  condition: (ctx: FilterValueOfContext<TRow>) => boolean,
  schema: (path: FiltersPath<TRow>) => void
): void {
  void path;
  const outerRecorder = currentFilterRecorder<TRow>();

  const session = createFilterRecorderSession<TRow>();
  const nestedPath = buildFiltersPath(session.recorder);
  withActiveFilterRecorder(session.recorder, () => schema(nestedPath));
  session.close();

  if (session.records.length === 0) {
    throw new Error('[createFilters] applyWhen(...) declared no rules inside its schema.');
  }

  for (const inner of session.records) {
    outerRecorder.record({ ...inner, kind: 'conditional', condition });
  }
}
