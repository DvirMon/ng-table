/**
 * What happens to a column once it becomes a grouping level. The major libraries pick different
 * defaults, so the story renders all three dispositions rather than choosing one; the comparison
 * is in `docs/0-product/grouping.md` §2.
 */
export type GroupedColumnMode = 'keep' | 'hide' | 'move-to-front';
