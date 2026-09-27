import { recorderOf } from './path-proxy';
import type { StageHandle } from './stage-schema';

/**
 * One recorded `stage()` call: the claim form (no `name`) takes a built-in anchor's slot; the
 * declare form adds a named stage next to its anchor.
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

/** Claim-form options: the transform that runs in the anchor's own built-in slot. */
export interface StageClaimOpts<TTransform> {
  readonly run: TTransform;
}

/**
 * Declare-form options: a new stage named `name`, placed before or after the handle's anchor.
 * `name` must be a merged registry key. Set `synthesizesRows` on a render stage that adds rows
 * absent from the data (e.g. group headers); it must land at or after `'group'`.
 */
export interface StageDeclareOpts<TTransform, TName extends string = string> {
  readonly name: TName;
  readonly placement: 'before' | 'after';
  readonly synthesizesRows?: boolean;
  readonly run: TTransform;
}

/**
 * Claims a built-in stage, or declares a new one next to it, inside a `stageSchema()` callback.
 *
 * @example
 * stageSchema('pipeline', (s) => {
 *   stage(s.filter, { name: 'dedupe', placement: 'after', run: dedupeRows });
 * });
 */
export function stage<TRow, TTransform, TName extends string>(
  handle: StageHandle<TRow, TTransform, TName>,
  // Note: `NoInfer` keeps `TName` inferred from `handle` alone. Without it a wider `name`
  // widens `TName` too, and an unmerged name compiles.
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
