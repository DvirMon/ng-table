/// <reference types="@vitest/browser-playwright" />
import { Component, signal, type Type, type WritableSignal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { cdp, commands } from 'vitest/browser';

import { NgpTableDirective } from './ngp-table.directive';
import { NgpTableRowMoveDirective } from './ngp-table-row-move.directive';
import { NgpTableRowDirective } from './ngp-table-row.directive';
import { createColumns } from '../api/create-columns';
import { createTable } from '../api/create-table';
import type { TableConfig } from '../api/types';
import { createMockRows, type MockRow } from '../table.mock';

// Diagnostic, not a gate (`nx run shared-table:bench-trace`). Records a Chrome performance trace
// of one plain and one animated 1000-row reversal under the same setup as
// ngp-table-row-move.bench.spec.ts, and writes it to `bench-trace.json` at the repo root —
// open it in DevTools › Performance, or read it with a script. The hosts mirror the bench's.

const TRACE_ROW_COUNT = 1000;
const WARM_UP_ROUNDS = 3;
const TRACE_FILE = 'bench-trace.json';
const TRACE_CHUNK_BYTES = 1024 * 1024;

// DevTools' own recording categories: timeline, JS samples, user timing.
const TRACE_CATEGORIES = [
  '-*',
  'devtools.timeline',
  'disabled-by-default-devtools.timeline',
  'disabled-by-default-devtools.timeline.frame',
  'disabled-by-default-devtools.timeline.stack',
  'v8.execute',
  'disabled-by-default-v8.cpu_profiler',
  'blink.user_timing',
  'toplevel',
  'latencyInfo',
];

const traceRowsWitness = (): readonly MockRow[] | undefined => undefined;

const TRACE_TABLE_CONFIG: TableConfig<MockRow> = {
  trackBy: 'id',
  columns: createColumns(traceRowsWitness, (col) => [col('name')]),
};

const TRACE_STYLES = `
  .bench-table { border-collapse: separate; border-spacing: 0; }
  .bench-cell { height: 24px; padding: 0 8px; }
`;

const ROWS_TEMPLATE = `
  <tbody>
    @for (row of table.renderRows(); track row.id) {
      <tr [ngpTableRow]="row"><td class="bench-cell">{{ row.data?.name }}</td></tr>
    }
  </tbody>
`;

const ANIMATED_TRACE_TEMPLATE = `<table class="bench-table" [ngpTable]="table" ngpTableRowMove>${ROWS_TEMPLATE}</table>`;
const PLAIN_TRACE_TEMPLATE = `<table class="bench-table" [ngpTable]="table">${ROWS_TEMPLATE}</table>`;

interface TraceHost {
  readonly data: WritableSignal<MockRow[]>;
}

@Component({
  selector: 'ngp-flip-trace-animated',
  imports: [NgpTableDirective, NgpTableRowMoveDirective, NgpTableRowDirective],
  template: ANIMATED_TRACE_TEMPLATE,
  styles: TRACE_STYLES,
})
class AnimatedTraceHost implements TraceHost {
  readonly data = signal<MockRow[]>([]);
  protected readonly table = createTable(this.data, TRACE_TABLE_CONFIG);
}

@Component({
  selector: 'ngp-flip-trace-plain',
  imports: [NgpTableDirective, NgpTableRowDirective],
  template: PLAIN_TRACE_TEMPLATE,
  styles: TRACE_STYLES,
})
class PlainTraceHost implements TraceHost {
  readonly data = signal<MockRow[]>([]);
  protected readonly table = createTable(this.data, TRACE_TABLE_CONFIG);
}

interface TraceRecorder {
  // Writes the trace to `TRACE_FILE`; resolves with its size in bytes.
  stop(): Promise<number>;
}

function allowMotion(): void {
  const realMatchMedia = window.matchMedia.bind(window);
  vi.stubGlobal('matchMedia', (query: string): MediaQueryList => {
    const isReducedMotionQuery = query.includes('prefers-reduced-motion');
    return realMatchMedia(isReducedMotionQuery ? 'not all' : query);
  });
}

function nextFrame(): Promise<number> {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

async function allAnimationsSettled(): Promise<void> {
  await Promise.allSettled(document.getAnimations().map((animation) => animation.finished));
  await nextFrame();
}

function mountTraceHost<THost extends TraceHost>(hostType: Type<THost>): ComponentFixture<THost> {
  const fixture = TestBed.createComponent(hostType);
  const hostElement: HTMLElement = fixture.nativeElement;
  hostElement.style.cssText = 'position: absolute; top: 0; left: 0;';
  fixture.componentInstance.data.set(createMockRows(TRACE_ROW_COUNT));
  TestBed.tick();
  TestBed.tick();
  fixture.componentInstance.data.update((rows) => [...rows]);
  TestBed.tick();
  return fixture;
}

// Whether a host's table is in the page and laid out — a table that isn't pays no layout.
function describeMount(fixture: ComponentFixture<TraceHost>): string {
  const host: HTMLElement = fixture.nativeElement;
  const table = host.querySelector('table');
  if (table === null) {
    return 'no <table>';
  }
  const { display, visibility, contentVisibility } = getComputedStyle(table);
  const rect = table.getBoundingClientRect();
  return [
    `connected=${table.isConnected}`,
    `parent=${host.parentElement?.tagName.toLowerCase() ?? 'none'}`,
    `display=${display}`,
    `visibility=${visibility}`,
    `contentVisibility=${contentVisibility}`,
    `rect=${rect.width.toFixed(0)}x${rect.height.toFixed(0)}@${rect.top.toFixed(0)}`,
    `rows=${table.rows.length}`,
  ].join(' ');
}

// Style recalc cost per element grows with the page's rule count — the bench page's recalc ran
// ~5× slower per element than the story's.
function describeStyles(): string {
  const sheets = [...document.styleSheets];
  const ruleCount = sheets.reduce((sum, sheet) => sum + countRules(sheet), 0);
  const styleTags = document.querySelectorAll('style').length;
  const linkTags = document.querySelectorAll('link[rel="stylesheet"]').length;
  const largest = sheets
    .map((sheet) => ({ href: sheet.href ?? 'inline', rules: countRules(sheet) }))
    .sort((a, b) => b.rules - a.rules)
    .slice(0, 3)
    .map(({ href, rules }) => `${rules}@${href.split('/').pop()}`);
  return [
    `sheets=${sheets.length}`,
    `rules=${ruleCount}`,
    `styleTags=${styleTags}`,
    `linkTags=${linkTags}`,
    `elements=${document.getElementsByTagName('*').length}`,
    `largest=[${largest.join(', ')}]`,
  ].join(' ');
}

function countRules(sheet: CSSStyleSheet): number {
  try {
    return sheet.cssRules.length;
  } catch {
    return 0; // cross-origin sheet
  }
}

// One reversal, marked with a user-timing measure so it is easy to find in the trace.
async function reverseAndSettle(host: TraceHost, label: string): Promise<number> {
  host.data.update((rows) => [...rows].reverse());
  const tickStart = performance.now();
  TestBed.tick();
  // Same as the bench: layout inside the timed tick for both variants.
  void document.documentElement.offsetHeight;
  const tickMs = performance.now() - tickStart;
  performance.measure(label, { start: tickStart, duration: tickMs });
  await nextFrame();
  await allAnimationsSettled();
  return tickMs;
}

// The trace comes back as a stream read with `IO.read` (request/response), not as
// `Tracing.dataCollected` events: Vitest's CDP event relay drops those large payloads. `on`,
// not `once`: Vitest's `once` removes its server listener twice and throws on the second.
async function startTrace(): Promise<TraceRecorder> {
  const session = cdp();
  const streamHandle = new Promise<string | undefined>((resolve) =>
    session.on('Tracing.tracingComplete', ({ stream }) => resolve(stream)),
  );
  await session.send('Tracing.start', {
    transferMode: 'ReturnAsStream',
    traceConfig: { includedCategories: TRACE_CATEGORIES },
  });
  return {
    stop: async () => {
      await session.send('Tracing.end');
      const stream = await streamHandle;
      if (stream === undefined) {
        return 0;
      }
      return copyStreamToFile(stream);
    },
  };
}

// Appends chunk by chunk, so no single message carries the whole trace. Returns the byte count.
async function copyStreamToFile(stream: string): Promise<number> {
  const session = cdp();
  await commands.writeFile(TRACE_FILE, '');
  let bytes = 0;
  let isAtEnd = false;
  while (!isAtEnd) {
    const chunk = await session.send('IO.read', { handle: stream, size: TRACE_CHUNK_BYTES });
    const text = chunk.base64Encoded ? atob(chunk.data) : chunk.data;
    await commands.writeFile(TRACE_FILE, text, { flag: 'a' });
    bytes += text.length;
    isAtEnd = chunk.eof;
  }
  await session.send('IO.close', { handle: stream });
  return bytes;
}

describe('NgpTableRowMoveDirective — bench trace (diagnostic)', () => {
  beforeEach(() => {
    allowMotion();
    TestBed.configureTestingModule({ imports: [AnimatedTraceHost, PlainTraceHost] });
  });
  afterEach(() => vi.unstubAllGlobals());

  it(`records one plain and one animated ${TRACE_ROW_COUNT}-row reversal`, async () => {
    const plainFixture = mountTraceHost(PlainTraceHost);
    const animatedFixture = mountTraceHost(AnimatedTraceHost);
    // Same re-attach as the bench: the second `createComponent` detached the first host.
    document.body.append(plainFixture.nativeElement);
    const plain = plainFixture.componentInstance;
    const animated = animatedFixture.componentInstance;
    await nextFrame();
    console.log(`bench trace mount: plain ${describeMount(plainFixture)}`);
    console.log(`bench trace mount: animated ${describeMount(animatedFixture)}`);
    console.log(`bench trace styles: ${describeStyles()}`);

    for (let round = 0; round < WARM_UP_ROUNDS; round++) {
      await reverseAndSettle(plain, `warm-up-plain-${round}`);
      await reverseAndSettle(animated, `warm-up-animated-${round}`);
    }

    const recorder = await startTrace();
    await nextFrame();
    const plainTickMs = await reverseAndSettle(plain, 'trace-plain-tick');
    const animatedTickMs = await reverseAndSettle(animated, 'trace-animated-tick');
    const traceBytes = await recorder.stop();

    console.log(
      `bench trace: plain tick ${plainTickMs.toFixed(1)} ms, ` +
        `animated tick ${animatedTickMs.toFixed(1)} ms, ` +
        `${traceBytes} bytes → ${TRACE_FILE}`,
    );

    plainFixture.destroy();
    animatedFixture.destroy();
    expect(traceBytes).toBeGreaterThan(0);
  }, 120_000);
});
