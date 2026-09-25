import { Component, signal, type Type, type WritableSignal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { NgpTableDirective } from './ngp-table.directive';
import { NgpTableRowAnimationDirective } from './ngp-table-row-animation.directive';
import { NgpTableRowDirective } from './ngp-table-row.directive';
import { createColumns } from '../api/create-columns';
import { createTable } from '../api/create-table';
import type { TableConfig } from '../api/types';
import { createMockRows, type MockRow } from '../table.mock';

// Real-browser benchmark (`nx run shared-table:bench`, Chromium via Playwright). It needs real
// layout and real Web Animations, so it never runs under jsdom's `test` target.
// Methodology and every number below: libs/table/docs/3-ui/work/row-animation/
// discovery-benchmark-thresholds.md, § Proposed methodology ("§PM" below).
// Deterministic facts (animation counts) gate at every size. Timing gates at 1000 rows only;
// 5000/10000 and the plain-host baseline are report-only.

const ROW_COUNTS = [100, 1000, 5000, 10000] as const;
const FLIP_DURATION_MS = 300; // the directive's default `flipTiming`
const MID_GLIDE_MS = 150;
const ROW_HEIGHT_PX = 24; // `.bench-cell` height

const BENCH_SAMPLING = {
  warmUpSamples: 3, // §PM › Sampling: 3 discarded warm-ups [S26][S18]
  measuredSamples: 10, // §PM › Sampling: at least 10 measured samples [S26][S18]
} as const;

const BENCH_THRESHOLDS = {
  maxOverheadMs: 1000 / 60, // §PM › Metrics "overhead": < 1 × 60 Hz frame at N=1000 [S3]
  maxReorderFrameMs: 50, // §PM › Metrics "reorder frame": < 50 ms long-frame line [S4][S5]
  maxOverheadScaling: 7.5, // §PM › Metrics "overhead scaling": 5× linear × 1.5 noise
  maxGlideLongFrames: 0, // §PM › Metrics "main-thread free during glide": 0 at N=100/1000 [S5][S7]
  droppedFrameFactor: 1.5, // §PM › Metrics "percent dropped rAF frames": > 1.5 × median [S7]
  timingGatedRowCounts: [1000], // §PM › Row counts: 1000 is the gated timing size
  glideGatedRowCounts: [100, 1000], // §PM › Metrics: long-frame gate at N=100/1000 only
  scalingRowCounts: { base: 1000, probe: 5000 }, // §PM › Metrics "overhead scaling"
} as const;

const benchRowsWitness = (): readonly MockRow[] | undefined => undefined;

const BENCH_TABLE_CONFIG: TableConfig<MockRow> = {
  trackBy: 'id',
  columns: createColumns(benchRowsWitness, (col) => [col('name')]),
};

// Separate borders + fixed row height: collapsed borders don't follow a transform, and a
// zero-height row never moves.
const BENCH_STYLES = `
  .bench-table { border-collapse: separate; border-spacing: 0; }
  .bench-cell { height: ${ROW_HEIGHT_PX}px; padding: 0 8px; }
`;

const ROWS_TEMPLATE = `
  <tbody>
    @for (row of table.renderRows(); track row.id) {
      <tr [ngpTableRow]="row"><td class="bench-cell">{{ row.data?.name }}</td></tr>
    }
  </tbody>
`;

interface BenchHost {
  readonly data: WritableSignal<MockRow[]>;
}

// Hoisted so `template:` below holds a plain identifier, not an inline `${ROWS_TEMPLATE}`
// interpolation — the angular-eslint template extractor reads a decorator's `template`
// property from raw source text, and a literal `${ROWS_TEMPLATE}` in that text reads as an
// unescaped `{`, which it mistakes for an unterminated ICU expansion.
const ANIMATED_BENCH_TEMPLATE = `<table class="bench-table" [ngpTable]="table" ngpTableRowAnimation>${ROWS_TEMPLATE}</table>`;
const PLAIN_BENCH_TEMPLATE = `<table class="bench-table" [ngpTable]="table">${ROWS_TEMPLATE}</table>`;

@Component({
  selector: 'ngp-flip-bench-animated',
  imports: [NgpTableDirective, NgpTableRowAnimationDirective, NgpTableRowDirective],
  template: ANIMATED_BENCH_TEMPLATE,
  styles: BENCH_STYLES,
})
class AnimatedBenchHost implements BenchHost {
  readonly data = signal<MockRow[]>([]);
  protected readonly table = createTable(this.data, BENCH_TABLE_CONFIG);
}

@Component({
  selector: 'ngp-flip-bench-plain',
  imports: [NgpTableDirective, NgpTableRowDirective],
  template: PLAIN_BENCH_TEMPLATE,
  styles: BENCH_STYLES,
})
class PlainBenchHost implements BenchHost {
  readonly data = signal<MockRow[]>([]);
  protected readonly table = createTable(this.data, BENCH_TABLE_CONFIG);
}

interface ReorderSample {
  tickMs: number;
  renderMs: number;
  startCostMs: number;
  animationsStarted: number;
  animationsAfterSettle: number;
  glideLongFrames: number | undefined;
  droppedFramePercent: number;
}

interface VariantSamples {
  plain: ReorderSample[];
  animated: ReorderSample[];
}

interface MidGlideResult {
  peakAnimations: number;
  animationsAfterFirstGlide: number;
  animationsAfterSettle: number;
}

interface SizeResult {
  rowCount: number;
  movedRows: number;
  animatedRows: number;
  plainMs: number;
  reorderFrameMs: number;
  reorderFrameMinMs: number;
  overheadMs: number;
  overheadMinMs: number;
  overheadTickMs: number;
  overheadRenderMs: number;
  overheadIqrMs: number;
  reorderFrameCv: number;
  glideLongFrames: number | undefined;
  droppedFramePercent: number;
  midGlide: MidGlideResult;
}

interface LongFrameRecorder {
  countSince(time: number): number | undefined;
  stop(): void;
}

// The directive skips `animate()` under reduced motion; pin the query to "no preference" so a
// host OS/CI setting can't silently turn the benchmark into a no-op.
function allowMotion(): void {
  const realMatchMedia = window.matchMedia.bind(window);
  vi.stubGlobal('matchMedia', (query: string): MediaQueryList => {
    const isReducedMotionQuery = query.includes('prefers-reduced-motion');
    return realMatchMedia(isReducedMotionQuery ? 'not all' : query);
  });
}

// The directive animates only rows on screen at either end of a move. A reversal of a table
// pinned to the viewport's top moves at most one screenful into view and one out of it.
function maxOnScreenGlides(movedRows: number): number {
  const rowsPerScreen = Math.ceil(window.innerHeight / ROW_HEIGHT_PX) + 1;
  return Math.min(movedRows, 2 * rowsPerScreen);
}

// Reversing an even-length list moves every row; an odd one leaves the middle row in place.
function countMovedByReversal(rowCount: number): number {
  return rowCount - (rowCount % 2);
}

function reverseRows(host: BenchHost): void {
  host.data.update((rows) => [...rows].reverse());
}

function quantile(values: readonly number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

function median(values: readonly number[]): number {
  return quantile(values, 0.5);
}

function interquartileRange(values: readonly number[]): number {
  return quantile(values, 0.75) - quantile(values, 0.25);
}

function coefficientOfVariation(values: readonly number[]): number {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return mean === 0 ? 0 : Math.sqrt(variance) / mean;
}

function nextFrame(): Promise<number> {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

// The next frame's rendering work, without the idle wait for vsync before it. A message queued
// from the frame's rAF callback runs once that frame's style/layout/paint is done — the style
// work and compositor setup for newly started animations lands there (§PM, § Repo facts).
function measureNextFrameRender(): Promise<number> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      const frameStart = performance.now();
      const channel = new MessageChannel();
      channel.port1.onmessage = (): void => {
        channel.port1.close();
        resolve(performance.now() - frameStart);
      };
      channel.port2.postMessage(null);
    });
  });
}

// Share of rAF intervals over `droppedFrameFactor` × the median interval (§PM, [S7]).
async function sampleDroppedFramePercent(durationMs: number): Promise<number> {
  const start = performance.now();
  const intervals: number[] = [];
  let previous = await nextFrame();
  while (previous - start < durationMs) {
    const now = await nextFrame();
    intervals.push(now - previous);
    previous = now;
  }
  const dropLine = BENCH_THRESHOLDS.droppedFrameFactor * median(intervals);
  const droppedCount = intervals.filter((interval) => interval > dropLine).length;
  return intervals.length === 0 ? 0 : (100 * droppedCount) / intervals.length;
}

// Long Animation Frames where Chromium exposes them, else long tasks (both > 50 ms by spec).
// `undefined` when neither exists — reported as such, never gated as a pass.
function longFrameEntryType(): string | undefined {
  const supported = PerformanceObserver.supportedEntryTypes;
  return ['long-animation-frame', 'longtask'].find((type) => supported.includes(type));
}

function recordLongFrames(entryType: string | undefined): LongFrameRecorder {
  if (entryType === undefined) {
    return { countSince: () => undefined, stop: () => undefined };
  }
  const entries: PerformanceEntry[] = [];
  const observer = new PerformanceObserver((list) => entries.push(...list.getEntries()));
  observer.observe({ type: entryType });
  return {
    countSince: (time) => {
      entries.push(...observer.takeRecords());
      return entries.filter((entry) => entry.startTime >= time).length;
    },
    stop: () => observer.disconnect(),
  };
}

async function allAnimationsSettled(): Promise<void> {
  await Promise.allSettled(document.getAnimations().map((animation) => animation.finished));
  await nextFrame();
}

// Brings style and layout up to date now. Both variants call it inside the timed tick: the
// animated one already paid for layout in the directive's first `offsetTop` read, while the
// plain one's layout would otherwise be deferred out of the measured window (a trace showed no
// style/layout in its next frame), charging the whole reorder's layout to the directive.
function forceLayout(): void {
  void document.documentElement.offsetHeight;
}

// One reorder: start cost = the tick that applies it + the next frame's rendering; then the
// glide is watched for main-thread long frames after that first frame.
async function sampleReorder(host: BenchHost, label: string): Promise<ReorderSample> {
  const longFrames = recordLongFrames(longFrameEntryType());

  reverseRows(host);
  const tickStart = performance.now();
  TestBed.tick();
  forceLayout();
  const tickMs = performance.now() - tickStart;
  const animationsStarted = document.getAnimations().length;
  const renderMs = await measureNextFrameRender();
  const startCostMs = tickMs + renderMs;
  performance.measure(label, { start: tickStart, duration: startCostMs });

  const firstFrameEnd = performance.now();
  const droppedFramePercent = await sampleDroppedFramePercent(FLIP_DURATION_MS);
  await allAnimationsSettled();
  const glideLongFrames = longFrames.countSince(firstFrameEnd);
  longFrames.stop();
  performance.clearMeasures(label);

  return {
    tickMs,
    renderMs,
    startCostMs,
    animationsStarted,
    animationsAfterSettle: document.getAnimations().length,
    glideLongFrames,
    droppedFramePercent,
  };
}

// Mounts the rows, then reorders nothing once so the directive's first `earlyRead` — which
// may run before every row has registered — has captured a full baseline of tops.
function mountBenchHost<THost extends BenchHost>(
  hostType: Type<THost>,
  rowCount: number,
): ComponentFixture<THost> {
  const fixture = TestBed.createComponent(hostType);
  // Both hosts are mounted at once; pin each to the viewport's top so neither table sits
  // below the other, off screen, where the directive would animate nothing.
  const hostElement: HTMLElement = fixture.nativeElement;
  hostElement.style.cssText = 'position: absolute; top: 0; left: 0;';
  fixture.componentInstance.data.set(createMockRows(rowCount));
  TestBed.tick();
  TestBed.tick();
  fixture.componentInstance.data.update((rows) => [...rows]);
  TestBed.tick();
  return fixture;
}

// Plain and animated alternate per sample so drift hits both equally (§PM › Sampling).
async function sampleInterleaved(rowCount: number): Promise<VariantSamples> {
  const plainFixture = mountBenchHost(PlainBenchHost, rowCount);
  const animatedFixture = mountBenchHost(AnimatedBenchHost, rowCount);
  // `TestBed.createComponent` removes every earlier root (`[id^=root]`) before adding its own,
  // so the second mount detached the plain host — which then never laid out or painted.
  document.body.append(plainFixture.nativeElement);
  expect(plainFixture.nativeElement.isConnected).toBe(true);
  expect(animatedFixture.nativeElement.isConnected).toBe(true);
  await nextFrame();

  const samples: VariantSamples = { plain: [], animated: [] };
  const totalSamples = BENCH_SAMPLING.warmUpSamples + BENCH_SAMPLING.measuredSamples;
  for (let index = 0; index < totalSamples; index++) {
    const plain = await sampleReorder(plainFixture.componentInstance, `plain-${rowCount}-${index}`);
    const animated = await sampleReorder(
      animatedFixture.componentInstance,
      `animated-${rowCount}-${index}`,
    );
    const isMeasuredSample = index >= BENCH_SAMPLING.warmUpSamples;
    if (isMeasuredSample) {
      samples.plain.push(plain);
      samples.animated.push(animated);
    }
  }

  plainFixture.destroy();
  animatedFixture.destroy();
  return samples;
}

// Re-reorders halfway through a glide: the second `animate()` stacks on the first until the
// first finishes, so the count may briefly double but must fall back once the first ends.
async function benchmarkMidGlideReorder(rowCount: number): Promise<MidGlideResult> {
  const fixture = mountBenchHost(AnimatedBenchHost, rowCount);
  const host = fixture.componentInstance;
  await nextFrame();

  reverseRows(host);
  TestBed.tick();
  const firstGlide = document.getAnimations();
  const glideStart = performance.now();
  while (performance.now() - glideStart < MID_GLIDE_MS) {
    await nextFrame();
  }

  reverseRows(host);
  TestBed.tick();
  const peakAnimations = document.getAnimations().length;

  await Promise.allSettled(firstGlide.map((animation) => animation.finished));
  await nextFrame();
  const animationsAfterFirstGlide = document.getAnimations().length;

  await allAnimationsSettled();
  const animationsAfterSettle = document.getAnimations().length;
  fixture.destroy();
  return { peakAnimations, animationsAfterFirstGlide, animationsAfterSettle };
}

function sumDefined(values: readonly (number | undefined)[]): number | undefined {
  const defined = values.filter((value): value is number => value !== undefined);
  return defined.length === 0 ? undefined : defined.reduce((sum, value) => sum + value, 0);
}

// Median of (animated − plain) per interleaved pair, for one part of the start cost.
function pairedOverhead(
  samples: VariantSamples,
  cost: (sample: ReorderSample) => number,
): number[] {
  return samples.animated.map((sample, index) => cost(sample) - cost(samples.plain[index]));
}

function summarize(
  rowCount: number,
  samples: VariantSamples,
  midGlide: MidGlideResult,
): SizeResult {
  const plainCosts = samples.plain.map((sample) => sample.startCostMs);
  const animatedCosts = samples.animated.map((sample) => sample.startCostMs);
  const pairedOverheads = pairedOverhead(samples, (sample) => sample.startCostMs);
  return {
    rowCount,
    movedRows: countMovedByReversal(rowCount),
    animatedRows: median(samples.animated.map((sample) => sample.animationsStarted)),
    plainMs: median(plainCosts),
    reorderFrameMs: median(animatedCosts),
    reorderFrameMinMs: Math.min(...animatedCosts),
    overheadMs: median(pairedOverheads),
    overheadMinMs: Math.min(...pairedOverheads),
    // Split: tick = Angular + the directive's measure/animate(); render = the browser's frame.
    overheadTickMs: median(pairedOverhead(samples, (sample) => sample.tickMs)),
    overheadRenderMs: median(pairedOverhead(samples, (sample) => sample.renderMs)),
    overheadIqrMs: interquartileRange(pairedOverheads),
    reorderFrameCv: coefficientOfVariation(animatedCosts),
    glideLongFrames: sumDefined(samples.animated.map((sample) => sample.glideLongFrames)),
    droppedFramePercent: median(samples.animated.map((sample) => sample.droppedFramePercent)),
    midGlide,
  };
}

function toTableRow(result: SizeResult): Record<string, string | number> {
  return {
    rows: result.rowCount,
    moved: result.movedRows,
    animated: result.animatedRows,
    plainMs: result.plainMs.toFixed(2),
    reorderFrameMs: result.reorderFrameMs.toFixed(2),
    reorderFrameMinMs: result.reorderFrameMinMs.toFixed(2),
    overheadMs: result.overheadMs.toFixed(2),
    overheadMinMs: result.overheadMinMs.toFixed(2),
    overheadTickMs: result.overheadTickMs.toFixed(2),
    overheadRenderMs: result.overheadRenderMs.toFixed(2),
    overheadIqrMs: result.overheadIqrMs.toFixed(2),
    reorderFrameCv: result.reorderFrameCv.toFixed(3),
    longFrameSource: longFrameEntryType() ?? 'n/a',
    glideLongFrames: result.glideLongFrames ?? 'n/a',
    droppedFramePct: result.droppedFramePercent.toFixed(1),
    midGlidePeak: result.midGlide.peakAnimations,
    midGlideAfterFirst: result.midGlide.animationsAfterFirstGlide,
  };
}

// Plain text, not `console.table`: browser mode doesn't reliably forward the table to the
// terminal.
function formatResultsTable(rows: readonly Record<string, string | number>[]): string {
  if (rows.length === 0) {
    return 'no results';
  }
  const columns = Object.keys(rows[0]);
  const cellsOf = (row: Record<string, string | number>): string[] =>
    columns.map((column) => String(row[column]));
  const widths = columns.map((column, index) =>
    Math.max(column.length, ...rows.map((row) => cellsOf(row)[index].length)),
  );
  const formatLine = (cells: readonly string[]): string =>
    cells.map((cell, index) => cell.padStart(widths[index])).join('  ');
  return [formatLine(columns), ...rows.map((row) => formatLine(cellsOf(row)))].join('\n');
}

function isGatedSize(gatedRowCounts: readonly number[], rowCount: number): boolean {
  return gatedRowCounts.includes(rowCount);
}

describe('NgpTableRowAnimationDirective — real-browser FLIP benchmark', () => {
  const results = new Map<number, SizeResult>();

  beforeEach(() => {
    allowMotion();
    TestBed.configureTestingModule({ imports: [AnimatedBenchHost, PlainBenchHost] });
  });
  afterEach(() => vi.unstubAllGlobals());
  afterAll(() => console.log(formatResultsTable([...results.values()].map(toTableRow))));

  it.each(ROW_COUNTS)(
    'reverses %i rows',
    async (rowCount) => {
      const onScreenGlides = maxOnScreenGlides(countMovedByReversal(rowCount));
      const samples = await sampleInterleaved(rowCount);
      const midGlide = await benchmarkMidGlideReorder(rowCount);
      const result = summarize(rowCount, samples, midGlide);
      results.set(rowCount, result);

      // Hard gates, every size: deterministic counts (§PM › Metrics).
      samples.plain.forEach((sample) => expect(sample.animationsStarted).toBe(0));
      samples.animated.forEach((sample) => {
        expect(sample.animationsStarted).toBeGreaterThan(0);
        expect(sample.animationsStarted).toBeLessThanOrEqual(onScreenGlides);
      });
      [...samples.plain, ...samples.animated].forEach((sample) =>
        expect(sample.animationsAfterSettle).toBe(0),
      );
      expect(midGlide.peakAnimations).toBeLessThanOrEqual(2 * onScreenGlides);
      expect(midGlide.animationsAfterFirstGlide).toBeLessThanOrEqual(onScreenGlides);
      expect(midGlide.animationsAfterSettle).toBe(0);

      const isTimingGated = isGatedSize(BENCH_THRESHOLDS.timingGatedRowCounts, rowCount);
      // Gated on the fastest sample, not the median: load from other processes only ever adds
      // time (same code swung 5× between runs), so the minimum is closest to the real cost.
      if (isTimingGated) {
        expect(result.overheadMinMs).toBeLessThan(BENCH_THRESHOLDS.maxOverheadMs);
        expect(result.reorderFrameMinMs).toBeLessThan(BENCH_THRESHOLDS.maxReorderFrameMs);
      }

      const isGlideGated = isGatedSize(BENCH_THRESHOLDS.glideGatedRowCounts, rowCount);
      const hasLongFrameData = result.glideLongFrames !== undefined;
      if (isGlideGated && hasLongFrameData) {
        expect(result.glideLongFrames).toBeLessThanOrEqual(BENCH_THRESHOLDS.maxGlideLongFrames);
      }
    },
    // Measured: 5000 rows took 147 s, 10000 rows exceeded 180 s (run of 2026-09-24).
    600_000,
  );

  // Machine-independent: superlinear growth is a bug class, a slow runner is not (§PM).
  it('overhead grows at most linearly (with noise) from 1000 to 5000 rows', () => {
    const { base, probe } = BENCH_THRESHOLDS.scalingRowCounts;
    const baseResult = results.get(base);
    const probeResult = results.get(probe);
    expect(baseResult).toBeDefined();
    expect(probeResult).toBeDefined();

    // A non-positive base overhead makes the ratio meaningless; the table still reports both.
    const hasPositiveBase = baseResult !== undefined && baseResult.overheadMs > 0;
    if (hasPositiveBase && probeResult !== undefined) {
      const ratio = probeResult.overheadMs / baseResult.overheadMs;
      expect(ratio).toBeLessThanOrEqual(BENCH_THRESHOLDS.maxOverheadScaling);
    }
  });
});

// Cost probes, report-only: the directive's two per-row steps timed alone, on bare rows with
// no Angular, so the tick overhead above can be split into "reads", "animate()" and the rest.
const PROBE_ROW_COUNT = 1000;
const PROBE_KEYFRAME_DELTA_PX = 24;
// Same timing as the directive's default `flipTiming`.
const PROBE_TIMING: KeyframeAnimationOptions = {
  duration: FLIP_DURATION_MS,
  easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
};

interface ProbeSample {
  forcedLayoutMs: number;
  offsetTopReadsMs: number;
  rectReadsMs: number;
  innerHeightReadsMs: number;
  animateCallsMs: number;
}

function mountProbeRows(rowCount: number): { table: HTMLTableElement; rows: HTMLElement[] } {
  const table = document.createElement('table');
  table.className = 'bench-table';
  const body = table.createTBody();
  const rows = Array.from({ length: rowCount }, (_, index) => {
    const row = body.insertRow();
    const cell = row.insertCell();
    cell.style.height = '24px';
    cell.textContent = `row ${index}`;
    return row;
  });
  document.body.append(table);
  return { table, rows };
}

// Reversing the rows dirties layout, as a reorder does before the directive's `earlyRead`.
function reverseProbeRows(table: HTMLTableElement, rows: HTMLElement[]): void {
  rows.reverse();
  table.tBodies[0].append(...rows);
}

function timeMs(work: () => void): number {
  const start = performance.now();
  work();
  return performance.now() - start;
}

async function sampleProbe(table: HTMLTableElement, rows: HTMLElement[]): Promise<ProbeSample> {
  reverseProbeRows(table, rows);
  const forcedLayoutMs = timeMs(() => void table.offsetHeight);
  let topsChecksum = 0;
  const offsetTopReadsMs = timeMs(() => {
    rows.forEach((row) => (topsChecksum += row.offsetTop));
  });
  expect(topsChecksum).toBeGreaterThan(0);
  let rectChecksum = 0;
  const rectReadsMs = timeMs(() => {
    rows.forEach((row) => (rectChecksum += row.getBoundingClientRect().top));
  });
  let heightChecksum = 0;
  const innerHeightReadsMs = timeMs(() => {
    rows.forEach(() => (heightChecksum += window.innerHeight));
  });
  expect(rectChecksum + heightChecksum).not.toBeNaN();
  const keyframes = [{ transform: `translateY(${PROBE_KEYFRAME_DELTA_PX}px)` }, { transform: 'none' }];
  const animations: Animation[] = [];
  const animateCallsMs = timeMs(() => {
    rows.forEach((row) => animations.push(row.animate(keyframes, PROBE_TIMING)));
  });
  animations.forEach((animation) => animation.cancel());
  await nextFrame();
  return { forcedLayoutMs, offsetTopReadsMs, rectReadsMs, innerHeightReadsMs, animateCallsMs };
}

describe('NgpTableRowAnimationDirective — per-step cost probes (report-only)', () => {
  it(`times forced layout, offsetTop/rect/innerHeight reads and animate() for ${PROBE_ROW_COUNT} bare rows`, async () => {
    const { table, rows } = mountProbeRows(PROBE_ROW_COUNT);
    const samples: ProbeSample[] = [];
    const totalSamples = BENCH_SAMPLING.warmUpSamples + BENCH_SAMPLING.measuredSamples;
    for (let index = 0; index < totalSamples; index++) {
      const sample = await sampleProbe(table, rows);
      const isMeasuredSample = index >= BENCH_SAMPLING.warmUpSamples;
      if (isMeasuredSample) {
        samples.push(sample);
      }
    }
    table.remove();

    const medianOf = (cost: (sample: ProbeSample) => number): string =>
      median(samples.map(cost)).toFixed(2);
    const iqrOf = (cost: (sample: ProbeSample) => number): string =>
      interquartileRange(samples.map(cost)).toFixed(2);
    console.log(
      formatResultsTable([
        {
          rows: PROBE_ROW_COUNT,
          forcedLayoutMs: medianOf((sample) => sample.forcedLayoutMs),
          offsetTopReadsMs: medianOf((sample) => sample.offsetTopReadsMs),
          rectReadsMs: medianOf((sample) => sample.rectReadsMs),
          innerHeightReadsMs: medianOf((sample) => sample.innerHeightReadsMs),
          animateCallsMs: medianOf((sample) => sample.animateCallsMs),
          animateCallsIqrMs: iqrOf((sample) => sample.animateCallsMs),
        },
      ]),
    );
  });
});
