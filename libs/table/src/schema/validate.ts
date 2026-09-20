/**
 * Construction-time check: every identifier a schema declared names a column
 * that exists. Deterministic, fires before any data flows — throws
 * (ADR-0014). `label` names the declaring surface in the message, so one
 * body serves `columnsSchema`, `withGrouping`, `withFiltering` and
 * `withSorting`.
 */
export function assertDeclarationsAreKnown(
  declaredIds: Iterable<string>,
  knownIds: Iterable<string>,
  label: string
): void {
  const known = new Set(knownIds);
  for (const declaredId of declaredIds) {
    if (!known.has(declaredId)) {
      throw new Error(
        `[${label}] Unknown column id "${declaredId}" — no column with ` +
          'this id exists in the `columns` array.'
      );
    }
  }
}
