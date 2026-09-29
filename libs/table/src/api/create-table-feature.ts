import type { DerivedDict } from './types';
import type { Feature, RowOf, Shape, TableFeatureSpec } from '../engine/types';

/** `0 extends 1 & T` is true only when `T` is `any` — distinguishes an unresolved generic
 * from a real inferred type. */
type IsAny<T> = 0 extends 1 & T ? true : false;

/** Belt-and-braces against `D` arriving as `any` (a `derive` typed `Feature<any, any>`), which
 * would otherwise widen the whole composed store. The no-derive call form cannot leak
 * `DerivedDict` at all — it is a separate overload with no `D` to infer. */
type NormalizeDerived<D> = IsAny<D> extends true ? {} : D;

/**
 * Authoring entry point for a `with-*()` feature. A consumer never names `TableFeatureSpec`
 * or the engine's row-recovery machinery directly — `factory`'s own signature infers both.
 *
 * Two call forms:
 * - `createTableFeature(factory)` — identity; returns `factory` unchanged as `Feature<In, Out>`.
 * - `createTableFeature(factory, derive)` — adds a trailing derive block. `derive` is called
 *   with the feature's own output already merged into its input (`In & Out`), so it can read
 *   this feature's members immediately and any later feature's member through a lazy read.
 *   Its contribution merges into the returned `Feature<In, Out & D>`.
 *
 * A member key repeated between the feature and its derive block throws here (see
 * `mergeMembers`). A key repeated across two different *features* is not this helper's
 * concern — the fold's `SlotRegistry` is the single collision authority.
 */
export function createTableFeature<In extends Shape, Out extends object>(
  factory: (input: In) => TableFeatureSpec<RowOf<In>, Out>
): Feature<In, Out>;
export function createTableFeature<In extends Shape, Out extends object, D extends DerivedDict>(
  factory: (input: In) => TableFeatureSpec<RowOf<In>, Out>,
  derive: Feature<In & Out, D>
): Feature<In, Out & NormalizeDerived<D>>;
// Implementation signature only — deliberately untyped. The two overloads above are the real
// contract; a generic implementation signature here would need `factory`'s `Out` to already
// satisfy `Out & D` in the no-`derive` branch, which no cast-free expression of this shape can
// give it (D is opaque to the compiler at this point, not resolved to `{}`).
export function createTableFeature(
  factory: (input: any) => TableFeatureSpec<any, any>,
  derive?: (input: any) => TableFeatureSpec<any, any>
): Feature<any, any> {
  if (!derive) {
    return factory;
  }

  return (input: any) => {
    const spec = factory(input);

    // Own members become own properties (visible to the block immediately); `input` stays the
    // prototype so a later feature's member — added to the store after this factory runs — is
    // still visible through a lazy read. A plain spread would freeze the store at this moment
    // and break "types are stricter than runtime" for reads deferred into a `computed()`.
    const blockInput = Object.assign(Object.create(input), spec.members ?? {});

    const derivedSpec = derive(blockInput);
    return mergeDerivedSpec(spec, derivedSpec);
  };
}

/** The spec keys a derive block may not declare — pipeline behaviour belongs to the feature. */
const PIPELINE_BEHAVIOR_KEYS = [
  'stages',
  'renderStages',
  'columnRules',
  'expandedRows',
  'contextRows',
  'parentLink',
] as const;

/**
 * Combines a feature's spec with its trailing derive block's spec. The block may only
 * contribute members — every `PIPELINE_BEHAVIOR_KEYS` entry stays `spec`'s alone, and a block
 * declaring any of them is a construction-time error (a derive block is not pipeline
 * behaviour). Lifecycle hooks chain feature-first, block-second.
 */
function mergeDerivedSpec<TRow, Out extends object, D extends DerivedDict>(
  spec: TableFeatureSpec<TRow, Out>,
  derivedSpec: TableFeatureSpec<TRow, D>
): TableFeatureSpec<TRow, Out & D> {
  const declaredPipelineKeys = PIPELINE_BEHAVIOR_KEYS.filter(
    (key) => derivedSpec[key] !== undefined
  );
  const hasDeclaredPipelineBehavior = declaredPipelineKeys.length > 0;
  if (hasDeclaredPipelineBehavior) {
    throw new Error(
      `[createTable] a trailing derive block may only contribute members, but it declared ` +
        `${declaredPipelineKeys.join(', ')}.`
    );
  }

  return {
    members: mergeMembers(spec.members, derivedSpec.members),
    stages: spec.stages,
    renderStages: spec.renderStages,
    columnRules: spec.columnRules,
    expandedRows: spec.expandedRows,
    contextRows: spec.contextRows,
    parentLink: spec.parentLink,
    setup: chainCallbacks(spec.setup, derivedSpec.setup),
    onDestroy: chainCallbacks(spec.onDestroy, derivedSpec.onDestroy),
    onRowsRemoved: chainCallbacks(spec.onRowsRemoved, derivedSpec.onRowsRemoved),
  };
}

/**
 * Merges a feature's own members with its derive block's members. A duplicate key would
 * otherwise spread-overwrite silently here while reaching the fold's `SlotRegistry` as one
 * already-merged key — invisible to `claimMember` — so this throws with the same wording,
 * naming both sides, to keep the registry the single collision authority.
 */
function mergeMembers<A extends object, B extends object>(a: A | undefined, b: B | undefined): A & B;
function mergeMembers(a: object | undefined, b: object | undefined): object {
  const merged: Record<string, unknown> = {};
  if (a) {
    for (const [key, value] of Object.entries(a)) {
      merged[key] = value;
    }
  }
  if (b) {
    for (const [key, value] of Object.entries(b)) {
      const isDuplicateMember = key in merged;
      if (isDuplicateMember) {
        throw new Error(
          `[createTable] the feature and its derive block both provide the "${key}" store member. ` +
            'Only one feature may provide each member.'
        );
      }
      merged[key] = value;
    }
  }
  return merged;
}

/** Runs `first` then `second` when both are declared; passes either through unchanged when
 * only one is. `setup`/`onDestroy`/`onRowsRemoved` all chain this way, feature first. */
function chainCallbacks<Args extends unknown[]>(
  first: ((...args: Args) => void) | undefined,
  second: ((...args: Args) => void) | undefined
): ((...args: Args) => void) | undefined {
  if (!first) {
    return second;
  }
  if (!second) {
    return first;
  }
  return (...args: Args) => {
    first(...args);
    second(...args);
  };
}
