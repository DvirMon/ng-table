# ngpTableRowAnimation — work summary (to 2026-09-25)

## Read first (in order)

- `active/production-benchmark/4-tasks/progress.md` — the plan to execute next
- `discovery-production-benchmark.md` — why the bench is being rebuilt (§ Decision, § Synthesis)
- `../../directives/row-animation.md` — the directive's contract (v0.8)
- `progress.md` in this folder — earlier work log
- `handoffs/handoff-row-animation-bench.md` (gitignored, local) — the step-by-step debugging
  timeline
- `libs/table/docs/work/correctness-pass/findings-schema-mutations-directives.md` — § F5 and the
  clean-check note on the directive

## Commits (oldest first)

| Hash      | Date       | Subject                                                                           | What it did                                                                                |
| --------- | ---------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `ef35fd8` | 2026-09-23 | feat(table): grouping-editing story glides rows via FLIP                          | First FLIP glide, in the grouping-editing story (story host + `grouping-editing-flip.css`) |
| `6829e92` | 2026-09-23 | docs(table): row-animation discovery and grouping animation plan                  | `1-plan-grouping-moves.md` + AG Grid group-animation discovery                             |
| `3c72f70` | 2026-09-23 | feat(table): FLIP survives a leaving row, enter/exit fades in the story           | Rows keyed by id so a leaving `<tr>` doesn't shift lookups; fades in the story             |
| `568df56` | 2026-09-23 | feat(table): ngpTableRowAnimation - opt-in FLIP directive split out of ngpTable   | New opt-in directive + token; `row-flip.css` → `row-animation.css` (enter/leave classes)   |
| `b804fa4` | 2026-09-23 | docs(table): row-animation work - plan, discovery, verification                   | Plan update, insert/delete discovery, header exit/enter verification, `progress.md`        |
| `652a402` | 2026-09-24 | docs(table/row-animation): discovery on view transitions and benchmark thresholds | `discovery-view-transitions.md` + `discovery-benchmark-thresholds.md` (§PM)                |
| `8e35eee` | 2026-09-24 | ref(table/row-animation): FLIP plays through Web Animations                       | Double `requestAnimationFrame` replaced by `element.animate()`; ADR-0026 styling contract  |
| `2e56363` | 2026-09-24 | test(table/row-animation): real-browser FLIP benchmark                            | `*.bench.spec.ts` + `bench` target (Vitest browser, Playwright Chromium)                   |
| `97b3e9d` | 2026-09-25 | fix(table): resolve angular-eslint parse errors in row-animation bench spec       | Template constants written as plain identifiers so the lint extractor parses them          |
| `400ed22` | 2026-09-25 | feat(table): glide only on-screen rows, clamping far moves to the screen edge     | `planGlide()` edge clamping; spec tests; `row-animation.md` v0.8                           |

## Where the directive stands

- FLIP via `element.animate()` in `afterRenderEffect` — `earlyRead`: `offsetTop` of every row +
  `getBoundingClientRect` of moved rows; `write`: `animate()`.
- Only rows on screen at either end animate; a far end clamps to the screen edge; off screen at
  both ends → jump. Reduced motion skips all.
- Real-page cost (Storybook story trace, 1000 rows): whole Reverse ~40 ms, directive ~15 ms
  (mostly layout the browser does anyway), click → paint ~100 ms.
- Consumer tables need `border-collapse: separate` + a row background for whole rows to glide.

## The benchmark saga (2026-09-25), short

- Vitest bench N=1000 overhead gate failed: 226 ms vs 16.7 ms.
- Wrong guesses: slow reads inside Vitest's iframe, plain deferring layout, a big stylesheet.
- Real bug: `TestBed.createComponent` detached the plain host → fixed (uncommitted). After it,
  overhead ~37 ms, but noise dominates (IQR ~95 ms, ~5× run-to-run).
- Conclusion: the measurement design, not the directive → rebuild as `apps/table-bench`
  (production build, fresh page per variant, 95 % CI, pass / fail / unsure). Plan written, not
  executed.

## Open items

- **F5 — row registration leaks on `track $index`** (from the 2026-09-24 correctness audit,
  `libs/table/docs/work/correctness-pass/findings-schema-mutations-directives.md` § F5).
  `NgpTableRowDirective` registers its element in an `effect()` with no `onCleanup`; with a
  consumer `@for` tracked by `$index`, deleting a middle row leaves stale entries in
  `rowElements` for the table's lifetime (retention only — stale ids are never read). Fix:
  unregister the previous id in `onCleanup`. Not addressed by `400ed22` or the benchmark plan.
- **Production benchmark** — plan at `active/production-benchmark/`, not executed.

## Uncommitted on purpose

- Bench spec changes (`ngp-table-row-animation.bench.spec.ts`)
- Trace spec (`ngp-table-row-animation.trace.bench.spec.ts`)
- `libs/table/tsconfig.bench.json`
- `libs/table/project.json` — `bench` / `bench-trace` targets
- `.gitignore` entries
- `libs/table/.storybook/main.ts` — `profile` tag
- Profile story (`src/stories/row-animation/`)
- Methodology-doc notes in `discovery-benchmark-thresholds.md` (they describe the uncommitted
  bench fixes above)

Plan step 6 decides the fate of the bench / trace / story files.

## Gotchas learned

- `TestBed.createComponent` removes every earlier `[id^=root]` — a second fixture detaches the
  first.
- Vitest `cdp()`: large `Tracing.dataCollected` events are dropped → use `ReturnAsStream` +
  `IO.read`; `once()` throws → use `on`.
- The unit-test builder typechecks every spec in its tsconfig → bench uses
  `tsconfig.bench.json`; other in-progress specs can block `nx test`.
- Collapsed table borders don't follow a transform.
