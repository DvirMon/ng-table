import { recorderOf } from './path-proxy';
import type { StageHandle } from './stage-schema';

/**
 * One `stage()` declaration. The claim form (no `name`) reuses a built-in anchor's own
 * slot; the declare form (`name` + `placement`) introduces a new stage next to that
 * anchor.
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
 * Declare form — introduces a new stage named `name` next to `handle`'s anchor. `TName`
 * pins `name` to the layer's own registry keys (`StagePath`'s key union carried through
 * `handle`), so an unmerged name is a compile error. `synthesizesRows` only applies to a
 * render stage that adds rows the source data didn't have (e.g. a group header).
 */
export interface StageDeclareOpts<TTransform, TName extends string = string> {
  readonly name: TName;
  readonly placement: 'before' | 'after';
  readonly synthesizesRows?: boolean;
  readonly run: TTransform;
}

/**
 * Claims or declares one stage relative to `handle`'s anchor, recording it via
 * `recorderOf(handle).record(rule)` — the same recording mechanism `grouping()`/
 * `groupKey()` use (`api/features/with-grouping/schema.ts`). `NoInfer<TName>` on the
 * declare-opts branch keeps `TName` inferred solely from `handle`'s own type argument —
 * without it, a wider `name` in `opts` would widen `TName` right along with it and never
 * get checked against the handle's registry keys.
 */
export function stage<TRow, TTransform, TName extends string>(
  handle: StageHandle<TRow, TTransform, TName>,
  opts: StageClaimOpts<TTransform> | StageDeclareOpts<TTransform, NoInfer<TName>>
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

function isStageDeclareOpts<TTransform, TName extends string>(
  opts: StageClaimOpts<TTransform> | StageDeclareOpts<TTransform, TName>
): opts is StageDeclareOpts<TTransform, TName> {
  return 'name' in opts;
}
