import { PIPELINE_ANCHOR_ELIGIBLE, PIPELINE_ANCHORS } from './pipeline';
import { RENDER_ANCHORS } from './render-stages';
import type { StageRule } from '../schema/stage-rules';

// Angular's global dev-mode flag. Declared locally because `tsconfig.lib.json` sets
// `"types": []`, so no ambient declaration is in scope. Module-scoped, so it cannot
// collide with another file's declaration. See `engine/columns.ts`.
declare const ngDevMode: boolean | undefined;

/** One `stage()` rule paired with its declaring feature's label, named in construction errors. */
export interface LabelledStageRule<TTransform> {
  readonly label: string;
  readonly rule: StageRule<TTransform>;
}

/** One stage in the resolved order: its name and the transform run at that position. */
export interface ResolvedStage<TTransform> {
  readonly name: string;
  readonly run: TTransform;
}

type Layer = 'pipeline' | 'render';
type Placement = 'before' | 'after';

// A declare-form rule flattened out of its `LabelledStageRule` wrapper — the shape every
// resolution step below actually works with.
interface DeclareEntry<TTransform> {
  readonly label: string;
  readonly name: string;
  readonly anchor: string;
  readonly placement: Placement;
  readonly synthesizesRows?: boolean;
  readonly run: TTransform;
}

type DeclareRule<TTransform> = Extract<StageRule<TTransform>, { name: string }>;

function isDeclareRule<TTransform>(rule: StageRule<TTransform>): rule is DeclareRule<TTransform> {
  return 'name' in rule;
}

function builtInsFor(layer: Layer): readonly string[] {
  return layer === 'pipeline' ? PIPELINE_ANCHORS : RENDER_ANCHORS;
}

function eligibleBuiltInsFor(layer: Layer): readonly string[] {
  return layer === 'pipeline' ? PIPELINE_ANCHOR_ELIGIBLE : RENDER_ANCHORS;
}

/**
 * Resolves a layer's claimed and declared stage rules into one execution order.
 *
 * @remarks
 * Runs every construction check: unknown or non-eligible anchor, cycle, duplicate declared
 * name, ambiguous tie, `synthesizesRows` before render `'group'`. Each throws in dev mode;
 * with `ngDevMode` off, the offending declare is dropped and an ambiguous tie falls back to
 * name order. Unclaimed built-ins are skipped.
 */
export function resolveStageOrder<TTransform>(
  layer: Layer,
  rules: readonly LabelledStageRule<TTransform>[]
): readonly ResolvedStage<TTransform>[] {
  const builtIns = builtInsFor(layer);
  const eligibleBuiltIns = eligibleBuiltInsFor(layer);

  const claims = new Map<string, TTransform>();
  const declares: DeclareEntry<TTransform>[] = [];
  for (const { label, rule } of rules) {
    if (isDeclareRule(rule)) {
      declares.push({
        label,
        name: rule.name,
        anchor: rule.anchor,
        placement: rule.placement,
        synthesizesRows: rule.synthesizesRows,
        run: rule.run,
      });
    } else {
      claims.set(rule.anchor, rule.run); // last claim wins — SlotRegistry throws on this, not here.
    }
  }

  const validDeclares = resolveDeclaredNames(declares, builtIns);
  resolveAnchors(validDeclares, builtIns, eligibleBuiltIns);

  const buckets = bucketByGap(validDeclares, builtIns, layer);

  return assemble(builtIns, claims, buckets);
}

// Dedupes declared names against each other and against built-ins. A collision throws in dev
// mode; off, a duplicate declared name keeps the later declaration and a name equal to a
// built-in is dropped in favor of the built-in slot.
function resolveDeclaredNames<TTransform>(
  declares: readonly DeclareEntry<TTransform>[],
  builtIns: readonly string[]
): Map<string, DeclareEntry<TTransform>> {
  const declaredByName = new Map<string, DeclareEntry<TTransform>>();
  for (const entry of declares) {
    const existing = declaredByName.get(entry.name);
    const collidesWithBuiltIn = builtIns.includes(entry.name);
    if (existing !== undefined || collidesWithBuiltIn) {
      assertNoDuplicateDeclaredName(entry.label, existing?.label, entry.name);
      if (collidesWithBuiltIn) continue;
    }
    declaredByName.set(entry.name, entry);
  }
  return declaredByName;
}

// Drops (or throws on) a declare whose anchor doesn't exist, or exists but isn't
// anchor-eligible — mutates `declaredByName` in place, removing the offending entries.
function resolveAnchors<TTransform>(
  declaredByName: Map<string, DeclareEntry<TTransform>>,
  builtIns: readonly string[],
  eligibleBuiltIns: readonly string[]
): void {
  const isKnownAnchor = (name: string): boolean =>
    builtIns.includes(name) || declaredByName.has(name);
  const isAnchorEligible = (name: string): boolean =>
    builtIns.includes(name) ? eligibleBuiltIns.includes(name) : declaredByName.has(name);

  for (const [name, entry] of [...declaredByName]) {
    if (!isKnownAnchor(entry.anchor)) {
      assertKnownAnchor(entry.label, entry.anchor);
      declaredByName.delete(name);
      continue;
    }
    if (!isAnchorEligible(entry.anchor)) {
      assertAnchorEligible(entry.label, entry.anchor);
      declaredByName.delete(name);
    }
  }
}

// Placement is a gap, not a bare edge: `after X` / `before X` both name the gap between two
// consecutive built-ins (X and its neighbor), and a declared stage anchored on another declared
// stage inherits that stage's gap. Gap `g` (0..builtIns.length) sits before `builtIns[g]` and
// after `builtIns[g - 1]`.
function gapFromBuiltIn(builtIns: readonly string[], anchor: string, placement: Placement): number {
  const index = builtIns.indexOf(anchor);
  return placement === 'after' ? index + 1 : index;
}

function bucketByGap<TTransform>(
  validDeclares: Map<string, DeclareEntry<TTransform>>,
  builtIns: readonly string[],
  layer: Layer
): Map<number, DeclareEntry<TTransform>[]> {
  const gapIndexCache = new Map<string, number>();
  const invalid = new Set<string>();

  function resolveGapIndex(name: string, visiting: string[]): number | undefined {
    if (gapIndexCache.has(name)) return gapIndexCache.get(name);
    if (invalid.has(name)) return undefined;
    const entry = validDeclares.get(name);
    if (!entry) return undefined;

    const cycleAt = visiting.indexOf(name);
    if (cycleAt !== -1) {
      const cycleNames = visiting.slice(cycleAt);
      const cycleLabels = cycleNames.map((n) => validDeclares.get(n)?.label ?? n);
      assertNoCycle(cycleNames, cycleLabels);
      for (const cycleName of cycleNames) invalid.add(cycleName);
      return undefined;
    }

    visiting.push(name);
    const gap = builtIns.includes(entry.anchor)
      ? gapFromBuiltIn(builtIns, entry.anchor, entry.placement)
      : resolveGapIndex(entry.anchor, visiting);
    visiting.pop();

    if (gap === undefined) {
      invalid.add(name);
      return undefined;
    }
    gapIndexCache.set(name, gap);
    return gap;
  }

  // `synthesizesRows` only applies to the render layer, checked by final gap position so it
  // fires even when render `'group'` itself is unclaimed.
  const groupIndex = layer === 'render' ? builtIns.indexOf('group') : -1;

  const buckets = new Map<number, DeclareEntry<TTransform>[]>();
  for (const name of validDeclares.keys()) {
    const gap = resolveGapIndex(name, []);
    if (gap === undefined) continue;
    const entry = validDeclares.get(name)!;

    if (groupIndex !== -1 && entry.synthesizesRows === true && gap <= groupIndex) {
      assertSynthesizesRowsAfterGroup(entry.label, entry.name);
      continue;
    }

    const bucket = buckets.get(gap) ?? [];
    bucket.push(entry);
    buckets.set(gap, bucket);
  }
  return buckets;
}

function assemble<TTransform>(
  builtIns: readonly string[],
  claims: Map<string, TTransform>,
  buckets: Map<number, DeclareEntry<TTransform>[]>
): ResolvedStage<TTransform>[] {
  const result: ResolvedStage<TTransform>[] = [];
  for (let gap = 0; gap <= builtIns.length; gap++) {
    const left = gap > 0 ? builtIns[gap - 1] : null;
    const right = gap < builtIns.length ? builtIns[gap] : null;

    for (const entry of orderGapEntries(buckets.get(gap) ?? [], left, right)) {
      result.push({ name: entry.name, run: entry.run });
    }

    if (right !== null) {
      const run = claims.get(right);
      if (run !== undefined) result.push({ name: right, run });
    }
  }
  return result;
}

// Orders the declared stages that fell into one gap. Each declare contributes exactly one
// "immediately adjacent to" edge (to its anchor's boundary, or to another declared stage in the
// same gap). Two edges claiming the same slot, or the gap splitting into more than one
// connected chain, means the graph doesn't fix a relative order — an ambiguous tie.
function orderGapEntries<TTransform>(
  entries: readonly DeclareEntry<TTransform>[],
  left: string | null,
  right: string | null
): readonly DeclareEntry<TTransform>[] {
  if (entries.length < 2) return entries;

  const LEFT_KEY = left ?? '\u0000start';
  const RIGHT_KEY = right ?? '\u0000end';
  const byName = new Map(entries.map((entry) => [entry.name, entry]));

  const outEdge = new Map<string, string>();
  const inEdge = new Map<string, string>();
  let collision: [string, string] | null = null;

  function addEdge(from: string, to: string): void {
    const existingOut = outEdge.get(from);
    if (existingOut !== undefined && existingOut !== to) {
      collision ??= [existingOut, to];
    } else {
      outEdge.set(from, to);
    }
    const existingIn = inEdge.get(to);
    if (existingIn !== undefined && existingIn !== from) {
      collision ??= [existingIn, from];
    } else {
      inEdge.set(to, from);
    }
  }

  for (const entry of entries) {
    if (entry.anchor === left && entry.placement === 'after') {
      addEdge(LEFT_KEY, entry.name);
    } else if (entry.anchor === right && entry.placement === 'before') {
      addEdge(entry.name, RIGHT_KEY);
    } else if (entry.placement === 'after') {
      addEdge(entry.anchor, entry.name);
    } else {
      addEdge(entry.name, entry.anchor);
    }
  }

  const parent = new Map<string, string>();
  function find(node: string): string {
    let root = node;
    while (parent.get(root) !== undefined && parent.get(root) !== root) {
      root = parent.get(root)!;
    }
    parent.set(node, root);
    return root;
  }
  function union(a: string, b: string): void {
    if (!parent.has(a)) parent.set(a, a);
    if (!parent.has(b)) parent.set(b, b);
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootA, rootB);
  }
  for (const [from, to] of outEdge) union(from, to);

  const names = entries.map((entry) => entry.name);
  const componentOf = new Map(names.map((name) => [name, find(name)]));
  const distinctComponents = new Set(componentOf.values());

  if (collision !== null || distinctComponents.size > 1) {
    assertNoAmbiguousOrder(collision ?? representativePerComponent(names, componentOf));
    return [...entries].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }

  const entryComponent = componentOf.get(names[0])!;
  const leftConnected = parent.has(LEFT_KEY) && find(LEFT_KEY) === entryComponent;

  const ordered: DeclareEntry<TTransform>[] = [];
  if (leftConnected) {
    let current = LEFT_KEY;
    while (outEdge.has(current)) {
      current = outEdge.get(current)!;
      const entry = byName.get(current);
      if (entry) ordered.push(entry);
    }
  } else {
    let current = RIGHT_KEY;
    const collected: DeclareEntry<TTransform>[] = [];
    while (inEdge.has(current)) {
      current = inEdge.get(current)!;
      const entry = byName.get(current);
      if (entry) collected.push(entry);
    }
    ordered.push(...collected.reverse());
  }
  return ordered;
}

// One representative name per disconnected component, in first-appearance order — names the
// competing stages in an ambiguous-order message without listing every member of each chain.
function representativePerComponent(
  names: readonly string[],
  componentOf: Map<string, string>
): [string, string] {
  const seen = new Set<string>();
  const reps: string[] = [];
  for (const name of names) {
    const root = componentOf.get(name)!;
    if (!seen.has(root)) {
      seen.add(root);
      reps.push(name);
    }
  }
  return [reps[0], reps[1]];
}

function assertNoDuplicateDeclaredName(
  label: string,
  existingLabel: string | undefined,
  name: string
): void {
  if (typeof ngDevMode !== 'undefined' && !ngDevMode) return;
  const detail =
    existingLabel !== undefined
      ? `"${existingLabel}" already declared it`
      : `"${name}" is already a built-in stage`;
  throw new Error(
    `[createTable] "${label}" declares stage "${name}", but ${detail} — duplicate stage name.`
  );
}

function assertKnownAnchor(label: string, anchor: string): void {
  if (typeof ngDevMode !== 'undefined' && !ngDevMode) return;
  throw new Error(
    `[createTable] "${label}" anchors on "${anchor}", but no stage named "${anchor}" is declared — unknown anchor.`
  );
}

function assertAnchorEligible(label: string, anchor: string): void {
  if (typeof ngDevMode !== 'undefined' && !ngDevMode) return;
  throw new Error(
    `[createTable] "${label}" anchors on "${anchor}", but "${anchor}" is not anchor-eligible.`
  );
}

function assertNoCycle(names: readonly string[], labels: readonly string[]): void {
  if (typeof ngDevMode !== 'undefined' && !ngDevMode) return;
  const quoted = names.map((name) => `"${name}"`).join(' -> ');
  throw new Error(
    `[createTable] Cycle detected among declared stages ${quoted}, declared by ${labels.join(', ')} — anchor one of them outside the cycle.`
  );
}

function assertNoAmbiguousOrder(names: readonly [string, string]): void {
  if (typeof ngDevMode !== 'undefined' && !ngDevMode) return;
  const quoted = names.map((name) => `"${name}"`).join(' and ');
  throw new Error(
    `[createTable] Declared stages ${quoted} have no fixed relative order — anchor one on the other.`
  );
}

function assertSynthesizesRowsAfterGroup(label: string, name: string): void {
  if (typeof ngDevMode !== 'undefined' && !ngDevMode) return;
  throw new Error(
    `[createTable] "${label}" declares "${name}" with synthesizesRows before "group" — a synthesized row must land at or after "group".`
  );
}
