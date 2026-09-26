import { recorderOf } from './path-proxy';
import type { StageHandle } from './stage-schema';

/**
 * One `stage()` declaration. The claim form (no `name`) reuses a built-in anchor's own
 * slot; the declare form (`name` + `placement`) introduces a new stage next to that
 * anchor. Resolving placement and executing a declared stage is issue #155's concern.
 */
export type StageRule<TTransform> =
  | { readonly anchor: string; readonly run: TTransform }
  | {
      readonly anchor: string;
      readonly name: string;
      readonly placement: 'before' | 'after';
      readonly synthesizesRows?: boolean;
      readonly run: TTransform;
    };

/** Claim form — reuses `handle`'s own built-in slot, nothing to place. */
export interface StageClaimOpts<TTransform> {
  readonly run: TTransform;
}

/**
 * Declare form — introduces a new stage named `name` next to `handle`'s anchor.
 * `synthesizesRows` only applies to a render stage that adds rows the source data didn't
 * have (e.g. a group header).
 */
export interface StageDeclareOpts<TTransform> {
  readonly name: string;
  readonly placement: 'before' | 'after';
  readonly synthesizesRows?: boolean;
  readonly run: TTransform;
}

/**
 * Claims or declares one stage relative to `handle`'s anchor, recording it via
 * `recorderOf(handle).record(rule)` — the same recording mechanism `grouping()`/
 * `groupKey()` use (`api/features/with-grouping/schema.ts`).
 */
export function stage<TRow, TTransform>(
  handle: StageHandle<TRow, TTransform>,
  opts: StageClaimOpts<TTransform> | StageDeclareOpts<TTransform>
): void {
  const rule: StageRule<TTransform> = isStageDeclareOpts(opts)
    ? {
        anchor: handle.id,
        name: opts.name,
        placement: opts.placement,
        synthesizesRows: opts.synthesizesRows,
        run: opts.run,
      }
    : { anchor: handle.id, run: opts.run };
  recorderOf<TRow, StageRule<TTransform>>(handle).record(rule);
}

function isStageDeclareOpts<TTransform>(
  opts: StageClaimOpts<TTransform> | StageDeclareOpts<TTransform>
): opts is StageDeclareOpts<TTransform> {
  return 'name' in opts;
}
