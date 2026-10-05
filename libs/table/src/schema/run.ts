import { createRecorderSession, type PathRecorder } from './path-proxy';

/**
 * Runs a recording-form schema fn once, synchronously, through a fresh
 * recorder session and returns the rules it recorded. The one body behind
 * every recording-form schema — `columnSchema()` and `withGrouping()` today.
 *
 * @remarks
 * `buildPath` owns the handle shape, so each key space keeps its own
 * handle type (`ColumnHandle`, `GroupingHandle`) and its own single,
 * well-typed proxy cast.
 */
export function runRecordedSchema<TRow, TRule, TPath>(
  buildPath: (recorder: PathRecorder<TRow, TRule>) => TPath,
  fn: (path: TPath) => void,
): readonly TRule[] {
  const session = createRecorderSession<TRow, TRule>();
  fn(buildPath(session.recorder));
  session.close();
  return session.rules;
}
