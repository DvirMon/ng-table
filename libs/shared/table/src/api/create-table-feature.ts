import type { TableFeature } from '../engine/types';

/**
 * Identity function for authoring a `with-*()` feature — no runtime behavior, exists only
 * so a feature factory's `core`/return type infer from `Members` without a consumer having
 * to name `TableCore`/`TableFeatureSpec` directly.
 */
export function createTableFeature<TRow, Members extends object = object>(
  feature: TableFeature<TRow, Members>
): TableFeature<TRow, Members> {
  return feature;
}
