# How do established benchmark suites measure a DOM operation's runtime cost (reorder 1,000 rows, plus a FLIP layer), and what is the production-grade way to build one for an Angular directive?

**Date:** 2026-09-25 · **Depth:** standard

## Decision (2026-09-25)

The production benchmark lives in a separate minimal Nx app, `apps/table-bench` — one bare page
per variant, no global CSS, rarely changed — not as routes in the docs app `apps/site`. Docs
changes (global CSS, fonts, bundle) would shift its numbers. The docs app is planned to replace
Storybook as the showcase, including the profile story's "watch the glide" role. Everything else
in this doc stays a proposal until designed.

Companion to [discovery-benchmark-thresholds.md](discovery-benchmark-thresholds.md), which
covers budgets, AG Grid, Handsontable and TanStack. This doc does not repeat them. It adds the
measurement *mechanics* and the statistics, and recommends a rebuilt harness.

## Answer

- **Reframe:** the bench's problem is not its threshold. It is three measurement defects, and
  every surveyed suite avoids all three:
  1. It runs dev mode. Dev mode adds a second change-detection pass on every tick [S37][S38].
     All serious suites use production builds [S9][S17].
  2. It runs both variants in one document. The suites load **one variant per fresh page**,
     round-robin [S2][S11].
  3. It reads one number per run and gates on it. The suites **sample until a confidence
     interval on the difference resolves**, and treat "can't tell" as its own outcome
     [S10][S11][S43].
- **Window:** measure *mutation → first frame rendered* per variant. That window captures both
  in-page cost (rAF + MessageChannel, which is how Preact and Speedometer do it)
  [S30][S31][S32][S33] and trace cost (click → `Commit`, which is how js-framework-benchmark
  does it) [S1]. The directive's `earlyRead` only moves layout *earlier* inside that window
  [R2]. So a tick-only window charges the directive for layout that the plain variant also
  pays, later in the same frame [R9].
- **Recommended setup:**
  - A minimal **production-built Nx app** with one page per variant.
  - Driven by a **plain Playwright + CDP** script (`playwright@1.63.0` is already installed)
    [R5][R6].
  - Tachometer-style statistics: 95 % CI on `animated − plain`, auto-sampling, and a
    three-way pass / fail / unsure result [S10][S11].
  - Tachometer itself is rejected as the driver. It runs on Selenium, its last release was
    2025-07, and its traces are diagnostic only [S12][S13][S11].
  - Keep the deterministic count gates in Vitest. Move all timing out of Vitest.

## Method

- Versions pinned:
  - `playwright-core@1.63.0`, `vitest@4.1.9`, `@angular/core@22.1.2` and `@angular/build@22.1.2`
    come from `node_modules` / `package.json` [R5][R6].
  - `tachometer@0.7.2` (gitHead `705d648`) and `@angular/benchpress@0.3.0` come from the
    registry [S14][S20]. `afterframe@1.0.2` comes from the registry, read on unpkg [S32].
- Git refs read (no npm artifact exists for these):
  - js-framework-benchmark `f2df01a` (2026-09-20).
  - angular/angular `846c73d` (2026-09-24).
  - lit/lit `01dbc66` (2026-09-14).
  - preactjs/benchmarks `ec93e1b` (2026-07-23).
  - treeherder `master ≈ 737610f` (2026-09-25).
  - catapult `main ≈ 6fd8bbe`. That GitHub mirror's newest commit is 2025-11-18, so it may lag
    Chromium's own copy.
  - devtools-frontend and devtools-protocol were read from `main`/`master`, **unpinned**.
- How sources were read: GitHub raw and contents API through WebFetch, 2026-09-25.
  angular.dev and web.dev pages were fetched on the same day. The installed Playwright types
  were read directly from `node_modules`.
- Reliability:
  - "Duration" does not mean the same thing across suites:
    - js-framework-benchmark: click → end of the first `Commit` after the last script or
      layout, from a trace [S1].
    - Preact: `performance.mark` → after-frame, in page [S30].
    - Tachometer: whatever `performance` entry the page emits [S11].
    - benchpress: `scriptTime` / `renderTime`, from the perf log [S19].
  - WebFetch returns summaries. Every code quote below was requested verbatim. Line numbers
    were not relied on.

## Evidence

### 1 · js-framework-benchmark (`f2df01a`)

- Default runner is Puppeteer. Other runners: Playwright, WebDriver, WebDriver-CDP, and
  Lighthouse [S5].
- Each iteration opens a **fresh page in a persistent browser**. The order is: load → `init()`
  (warm-ups) → CPU throttle → trace start → forced major GC → `run()` → trace stop → throttle
  reset [S2].
- The GC call is `window.gc({type:'major',execution:'sync',flavor:'last-resort'})`, enabled by
  `--js-flags=--expose-gc` [S2][S4].
- Trace categories: `devtools.timeline`, `disabled-by-default-devtools.timeline`,
  `blink.user_timing`, `disabled-by-default-v8.cpu_profiler` [S2].
- Duration = `(commit.end − click.ts) / 1000`. `commit` is the first `Commit` event after the
  last `click`, `fireAnimationFrame`, `timerFire`, `layout` or `functioncall` [S1].
- Script time sums `EventDispatch`, `EvaluateScript`, `FunctionCall`, `FireAnimationFrame` and
  `TimerFire`. Paint time sums `UpdateLayoutTree`, `Layout`, `Commit`, `Paint` and `Layerize`.
  Overlapping intervals are merged before summing [S1].
- The input is a real click on a button in the page. For example, `swap rows` clicks
  `#swaprows` and then waits for the cell text in rows 2 and 999 to change [S3].
- `05_swap1k`: "swap 2 rows for table with 1,000 rows", 5 warm-ups, **4× CPU throttle**.
  `01_run1k` has 5 warm-ups and no throttle entry [S8].
- 15 CPU iterations. The drop-slowest count is 0 [S5].
- Viewport is 1280×800. The browser runs headed by default; `--headless=new` is added only
  when opted in [S4].
- README: "keep the chrome window visible since otherwise it seems like paint events can be
  skipped leading to wrong results" [S9].
- Every entry must build with `npm run build-prod` [S9].
- The runner computes min, max, median, mean and stddev (n−1), with no test [S6].
- The results UI runs a t-test against a chosen baseline, with `p > 0.05` shown as
  "undecided". It uses an unpooled standard error with `n1 + n2 − 2` degrees of freedom, so it
  is Welch's statistic with Student's df. Its CI is `1.96 · sd / √n` [S7].

### 2 · Tachometer (`0.7.2`)

- It **round-robins across variants, and each sample loads a fresh page** [S11].
- Measurement modes:
  - `callback`, `global` (`window.tachometerResult`), `performance` (a named mark or
    measure), and `fcp` [S11].
  - An **external URL gets FCP only**, so the page must be served from tachometer's own root
    [S11].
- `computeDifference()` builds a 95 % CI on both the absolute and the relative difference of
  means. It uses Student's t with `min(nA, nB) − 1` df, "since that will lead to a wider
  confidence interval" [S10].
- Auto-sampling:
  - At least 50 samples per variant, then it keeps sampling until **no difference CI contains
    any condition value**, or until the 3-minute timeout [S10][S11].
  - The default condition is `0%` ("is A faster or slower at all?"). A horizon such as `10%`
    or `0.5ms` asks it to place the CI on one side of that value [S11].
- Supports `cpuThrottlingRate` (via `Emulation.setCPUThrottlingRate`), `headless`, and
  `windowSize` [S12].
- `trace: true` saves JSON for `about:tracing`. It is "for diagnostic purposes", not
  measurement [S11][S12].
- Driven by `selenium-webdriver` plus chromedriver [S12][S11]. The last commit is the 0.7.2
  release on **2025-07-03** [S13].

### 3 · Framework in-repo infrastructure

- **Angular** (`modules/benchmarks`, `846c73d`):
  - Uses benchpress, driven by **Protractor** through `SeleniumWebDriverAdapter`, and runs
    only as a Bazel test [S15][S17].
  - `RegressionSlopeValidator` with `PERF_SAMPLE_SIZE` defaulting to 20. Forced GC is
    opt-in [S15][S18].
  - `js-web-frameworks` reimplements the jfb operations (create1K, delete1K, select, update,
    **swap**) as `prepare` / `work` pairs [S16].
  - Metrics: `scriptTime`, `renderTime`, `gcTime`, `pureScriptTime`, and `frameTime.*` for
    animations, all read from the WebDriver performance log. User metrics come from
    `console.time` markers or window properties [S19].
  - benchpress warns that `forceGc` skews `scriptTime` and `gcTime`, and asks for fixed-CPU,
    isolated machines [S19].
  - The published `@angular/benchpress@0.3.0` is marked EOL [S20]. The in-repo copy is still
    used.
  - `/benchmark-compare <sha>` runs on `ubuntu-latest` and posts a PR comment, not a gate
    [S21].
- **Lit** (`01dbc66`):
  - Tachometer, `sampleSize: 30`, `timeout: 0`, headless Chrome [S22].
  - `mode: "performance"` on named entries (`render`, `update`) [S22].
  - Variants are `this-change`, `tip-of-tree` (git dependency) and `previous-release`, all
    swapped through tachometer `packageVersions` [S22].
  - CI runs on every PR on `ubuntu-latest`, uploads JSON, and posts a comment through
    `andrewiggins/tachometer-reporter-action`. **It never fails a check** [S23][S24].
- **Preact** (`preactjs/benchmarks`, a git submodule of `preact`) [S26]:
  - Its own CLI wraps a **patched `tachometer@0.7.0`** and adds `jstat` [S28][S29].
  - Defaults: `--horizon 5%`, `--sample-size 25`, `--timeout 1` minute, `chrome-headless`,
    and an optional `--trace` [S27].
  - Variants are dependency versions (`preact@local` vs `preact@latest`) and implementations
    [S27].
  - `table-app/reorder1k.html` (added 2026-07) is the closest published analogue to this
    directive's operation: 3 warm-up `displace(3)` calls, then
    `mark("start")` → mutation → `markRunEnd` → `afterFrameAsync()` → DOM assertion →
    `mark("stop")` → `measure("duration")` [S30].
  - `afterFrameAsync` wraps `afterframe` [S31]. `afterframe@1.0.2` queues a callback in rAF
    and fires it through a `MessageChannel` message, i.e. after that frame's rendering work
    [S32].
- **Speedometer 3.1** times the synchronous step, then approximates async UI-thread work
  "with a zero-second timer that is scheduled immediately after each execution of synchronous
  operations" [S33]. Same after-frame idea as Preact.

### 4 · Chrome lab measurement primitives

- Trace events:
  - `EventTiming` is an async-nestable begin/end pair carrying `interactionId`, `type`,
    `duration`, `processingStart` and `processingEnd` [S34].
  - `AnimationFrame` is a begin/end pair, and `AnimationFrame::Presentation` is an instant
    event [S34].
  - These are what the DevTools Interactions and frames tracks read. Source is unpinned
    `main`.
- DevTools' Interactions track splits input delay / processing / presentation delay. web.dev
  recommends CPU throttling when a slow interaction won't reproduce (updated 2024-10-17)
  [S35].
- CDP `Tracing.start`:
  - `transferMode: "ReturnAsStream"` returns an IO stream handle on `tracingComplete` [S36].
  - This matches the repo's finding that `dataCollected` drops large payloads [R9].
- Playwright 1.63 offers two ways in:
  - `browser.startTracing(page, { categories, path, screenshots })` and `stopTracing()`
    (Chromium only).
  - `context.newCDPSession(page)` for raw CDP [R6].
- Angular's DevTools custom track (`enableProfiling()`) "works exclusively in development
  mode" [S39]. In a production build, per-directive attribution has to come from User Timing
  or from the trace.
- Dev mode "performs an additional check after each change detection run" [S37]. Dev mode is
  on unless `enableProdMode` is called or the app is built with `optimization` [S38].

### 5 · Statistical gating practice

- **Firefox Perfherder:**
  - Uses Welch's t (`delta / √(v1/n1 + v2/n2)`) over a sliding window: 12–24 runs back and 12
    runs forward, with `t_threshold = 7` [S40][S41].
  - It then alerts only when the change is ≥ `PERFHERDER_REGRESSION_THRESHOLD = 2` %
    [S41][S42].
  - This is significance **and** magnitude.
- **Chromium Pinpoint:**
  - `p = min(KS, Mann-Whitney U)`, because "MWU is bad at detecting changes in variance" and
    "K-S is bad with discrete distributions".
  - Outcome is `DIFFERENT` (≤ low threshold), `UNKNOWN` (between the two thresholds, meaning
    more samples are needed) or `SAME` [S43].
- **Tachometer:** a CI on the difference, resolved against a horizon. Otherwise the result is
  "unsure" [S10][S11].
- **AG Grid and Handsontable** (sibling doc):
  - AG Grid runs a live A/B: `|z| > 1.96` **and** ≥ 5 %.
  - Handsontable compares against the median of 5 goldens and gates at 15 %. Its measured
    spread is 11–19 %, and it moved to a self-hosted runner [R8].
- **No surveyed suite gates on an absolute ms number.** Every gate is either relative, or a
  two-sided significance test plus a magnitude floor [S21][S24][S40][S43][R8].

### Repo facts

- One document holds both the plain and the animated host. Timing brackets `TestBed.tick()` +
  forced layout, then a rAF + MessageChannel render measurement [R1].
- The gates use the **minimum** of 10 samples against an absolute 16.7 ms and 50 ms [R1].
- The directive's `earlyRead` reads `offsetTop` on every registered row, and `write` calls
  `animate()` on the moved rows that are on screen [R2].
- The `bench` target is `@nx/angular:unit-test` on `ChromiumHeadless` [R3].
- `@angular/build:unit-test` accepts a `buildTarget` whose default is the **`development`**
  configuration [R7]. Whether a production `buildTarget` works under TestBed is unverified.
- `apps/site` already has an `@angular/build:application` target with `production` as its
  default configuration, plus `serve-static` [R4].

## Comparison — harness mechanics

| Axis | js-framework-benchmark | Tachometer | Angular benchpress | Lit | Preact bench | This repo today |
|---|---|---|---|---|---|---|
| Driver | Puppeteer [S5] | Selenium [S12] | Protractor/Selenium [S15] | Tachometer [S25] | patched Tachometer [S28] | Vitest browser [R3] |
| Build | prod required [S9] | whatever is served [S11] | Bazel prod bundle [S17] | built packages [S22] | Vite [S29] | dev-mode TestBed [R1] |
| Variant isolation | page per iteration [S2] | page per sample, round-robin [S11] | one app per target [S16] | page per sample [S22] | page per sample [S28] | two hosts, one document [R1] |
| Trigger | real click [S3] | page script [S11] | Protractor click [S16] | page script [S22] | page script [S30] | `data.update` + `TestBed.tick()` [R1] |
| Window | click → first `Commit` after last work [S1] | page's perf entry [S11] | perf log script/render [S19] | `render`/`update` measures [S22] | mark → after-frame [S30][S32] | tick + forced layout + next-frame render [R1] |
| Warm-up | 5 [S8] | page-defined [S11] | `prepare` [S16] | page-defined [S22] | 3 [S30] | 3 [R1] |
| Samples | 15 fixed [S5] | ≥50, auto to CI [S11] | regression slope, 20 [S18] | 30 fixed [S22] | ≥25, auto 1 min [S27] | 10 [R1] |
| Throttle | 4× for swap [S8] | optional [S12] | none stated [S15] | none [S22] | none stated [S27] | none [R1] |
| Statistic | mean/median; t-test p≤.05 in UI [S6][S7] | 95 % CI of diff [S10] | slope ≥ 0 [S19] | 95 % CI of diff [S10][S22] | CI vs 5 % horizon [S27] | min and median [R1] |
| Gate | none | none built-in; unsure state [S11] | PR comment [S21] | PR comment, never fails [S24] | none (interactive) [S27] | absolute 16.7 / 50 ms [R1] |

## Comparison — driver options against this repo's requirements

Requirements come from the brief and the handoff [R9]: runs on Windows, uses what is installed,
a real prod page, per-variant isolation, trace access, a CI on the difference, and a DOM-level
FLIP window.

| Requirement | Plain Playwright + CDP | Tachometer 0.7.2 | Vitest browser mode (fixed) | Storybook profile story |
|---|---|---|---|---|
| Already installed | yes, 1.63.0 [R5][R6] | no; also needs chromedriver [S12] | yes [R5] | yes [R5] |
| Prod build | yes, serves any dist [R4] | yes, if served from its root [S11] | default `development` [R7]; prod untested | no, dev mode [R9][S39] |
| Fresh page per sample | yes, `newPage()` (own code) [R6] | built-in [S11] | no, one document per file [R1] | manual only |
| Real input event | `page.click` [R6] | no, page script [S11] | no [R1] | manual |
| Trace as measurement | yes, `Tracing.start` stream [S36][R6] | no, diagnostic only [S11] | yes via `cdp()`, as `bench-trace` [R9] | manual DevTools |
| CPU throttle | `Emulation.setCPUThrottlingRate` [R8] | `cpuThrottlingRate` [S12] | via `cdp()` [R8] | manual |
| CI on difference + auto-sample | must write (~50 lines) | built-in [S10] | must write | none |
| Maintenance risk | Playwright is active and already a dep | dormant since 2025-07 [S13] | `bench` is experimental in v4 [R8] | tied to Storybook + MSW [R9] |

## Synthesis

- **Window: after-frame, not tick.**
  - Preact, Speedometer and js-framework-benchmark all end their window after the frame's
    rendering work [S30][S33][S1]. None stops at the end of script.
  - This matters for FLIP specifically. The plain variant pays layout inside the frame's
    rendering. The animated variant pays it earlier, in `earlyRead`'s first `offsetTop` read
    [R2].
  - A tick-only window (what `overheadTickMs` measures [R1]) therefore compares apples with
    oranges. The handoff's trace shows exactly this: plain did no layout in its tick, animated
    paid ~100 ms there [R9].
  - Only the full mutation → frame-rendered window makes `animated − plain` mean "extra work
    the directive adds".
- **In-page vs trace timing.**
  - In-page after-frame timing is what Preact and Lit gate their comparisons on [S30][S22].
    jfb uses the trace [S1].
  - They disagree for a reason. The trace sees GPU, compositor and `Commit` work, and can split
    script from style/layout. In-page timing is cheap and cannot be dropped the way paint
    events are in a hidden window [S9].
  - Use in-page timing as the sampled metric. Take one trace per variant per run as the
    diagnostic split, which is tachometer's own position on traces [S11].
- **The jfb end rule does not transfer as-is.** "First `Commit` after the last layout or
  function call" [S1] would stretch into the 300 ms glide if the main thread keeps committing
  during it. Cut at the first `Commit` / `AnimationFrame::Presentation` after the input
  instead [S34]. This is an inference and has not been traced.
- **Noise: statistics, not the minimum.**
  - Every surveyed suite estimates with the mean or median plus a test [S6][S7][S10][S40][S43].
    None gates on the minimum.
  - The minimum is defensible when "load only adds time", but it has no error bar, and a 5×
    swing between runs [R9] says the environment is not stationary.
  - Tachometer and Pinpoint both answer an unresolved difference with a *third* outcome —
    unsure / UNKNOWN — rather than pass or fail [S11][S43]. That is exactly what a noisy
    Windows dev machine needs.
- **Absolute vs relative, again.**
  - Lit and Angular post comments, and Lit never fails [S24][S21]. Perfherder alerts only on
    significance plus ≥ 2 % [S41].
  - An absolute 16.7 ms gate can still be expressed statistically: "the 95 % CI upper bound of
    `animated − plain` < 16.7 ms". It then passes only when the data *supports* it, fails only
    when the CI lower bound clears 16.7 ms, and is otherwise unsure. That is tachometer's
    horizon mechanism with the horizon set in ms [S10][S11].
- **One harness, not three.** Today there are three measuring surfaces: the Vitest bench, the
  `bench-trace` spec and the Storybook profile story [R9]. The surveyed suites keep one driver
  that samples and traces the same page [S2][S27]. Prefer one general harness that both samples
  and traces, over a separate tool per question.

## Proposed setup — PROPOSAL, not adopted

**Page:** a new Nx app `apps/table-bench` (`@angular/build:application`, `production` default,
zoneless). Model it on `apps/site`'s build and `serve-static` targets [R4].

- Two entry pages, `plain.html` and `animated.html`, or one page with `?variant=`. Each mounts
  one table of N rows (N from the query string) with the same CSS as today [R1].
- One button, `#reverse`. Its handler does
  `performance.mark('start')` → `data.update(reverse)` → `afterFrame` → `mark('stop')` →
  `measure('reorder')`. This is Preact's `reorder1k` shape [S30][S31].
- Assert the DOM after each reorder (first-row text), as every suite does [S3][S30].
- A third page, `reorder-bare.html`, holds the no-Angular probe, to keep the per-step split
  [R1].

**Driver:** a Node script using the installed `playwright` [R5][R6].

- One browser. Each sample opens a **fresh page**, and variants alternate round-robin
  [S2][S11].
- Headed by default, following jfb's paint-skipping warning [S9]. If run headless, use
  `channel: 'chromium'` [R8].
- Fixed viewport. `--js-flags=--expose-gc` with a forced GC before the measured reorder [S2][S4].
- 5 warm-up reorders per page, then 1 measured reorder via `page.click('#reverse')` [S8][S3].
- Read `performance.getEntriesByName('reorder')` [S11].
- One traced sample per variant per run: `Tracing.start({ transferMode: 'ReturnAsStream' })`
  with jfb's categories [S2][S36]. Summarize script vs style/layout/paint with jfb's event
  sets [S1]. This replaces `bench-trace` [R9].
- Optionally repeat at 4× through `Emulation.setCPUThrottlingRate`, report-only [S8][R8].

**Statistics:** port tachometer's `computeDifference` [S10].

- Welch-style SE, and Student's t at `min(n) − 1` df, which is conservative.
- Keep sampling while the CI straddles the horizon.
- Minimum 25 per variant (Preact) [S27], timeout 3 min (tachometer) [S11].
- `jstat` is what tachometer, Preact and the jfb UI use [S14][S29][S7]. Otherwise a small
  t-quantile table is enough.

**Gate at N=1000**, three-way:

| Result | Condition | Exit |
|---|---|---|
| pass | CI upper bound of `animated − plain` < 16.7 ms | 0 |
| fail | CI lower bound > 16.7 ms | 1 |
| unsure | otherwise, after timeout | 0, loudly reported |

- The absolute reorder-frame number (< 50 ms) and the 5000/10000 scaling stay **report-only**
  on a dev machine [R8].
- Run it by hand (`nx run table-bench:bench`), never on shared CI, until a quiet runner exists
  [R8][S21].

**What it replaces**

- **Vitest `bench`:**
  - Its *timing* sections go: overhead, reorder frame, min gates, and the probes (which move to
    `reorder-bare.html`) [R1].
  - Its *deterministic* gates stay in Vitest browser mode, and they are correct there:
    animations started ≤ on-screen, settle to 0, and the mid-glide peak [R1].
- **`bench-trace` spec:** replaced by the driver's traced sample [R9].
- **Storybook profile story:** redundant once a prod page exists. It is dev-mode by
  construction [S39][R9].

**Cost:**

- New app: `project.json`, `main.ts`, two host components and `index.html`s. Roughly 6–8
  files.
- Driver: roughly 200–300 lines. Stats: roughly 50 lines.
- New dependencies: none required. `jstat` is optional.
- Ongoing cost: the app has to follow the library's API changes like any consumer.

## Against

- Tachometer gives auto-sampling, the CI, round-robin and a version-swap A/B with **zero driver
  code**, and Lit and Preact both use it [S22][S28].
  - Accepting Selenium, chromedriver and a dormant repo would buy all of that for free.
  - It also compares *library versions*, which the Playwright script does not
    (`packageVersions`) [S22].
- A prod app is a second consumer to maintain. benchpress needed Bazel [S17], and the
  published package still died [S20].
- A fixed Vitest bench (one host per document, `buildTarget` production) might get most of the
  way for less. Whether TestBed runs under an optimized build is unverified [R7].
- Headed runs on a dev machine are exposed to window focus and other apps. jfb accepts this
  for paint fidelity [S9]. Nobody surveyed publishes Windows-specific guidance.

## Not researched

- Solid, Svelte, Vue and React in-repo DOM benchmarks. They are likely node-only reactivity
  benches, but that was not opened.
- Chrome's `crossbench` and Telemetry as a lab runner.
- Whether `AnimationFrame` / `EventTiming` trace events are emitted by
  chromium-headless-shell.
- Windows-specific noise control (power plan, process priority, timer resolution).
- Tachometer's behavior on Windows with chromedriver auto-install.

## Unverified

- That the jfb end rule would extend into the glide for the animated variant. This is an
  inference from [S1]. To confirm: one trace of `animated.html`, locating the first `Commit`
  after the click and the last `Layout`.
- That `@angular/build:unit-test` with a production `buildTarget` runs TestBed and strips
  `ngDevMode`. To confirm: set it on a scratch target and log `ngDevMode` in a spec.
- The size of dev mode's cost on this reorder. Its *existence* is cited [S37]; no ms figure was
  found or measured.
- Preact's patch to tachometer: the patch file was not opened [S28].
- Pinpoint's actual `low_threshold` / `high_threshold` values. They are passed in by the
  caller and were not read [S43].

## Sources

| | Source | Version | Verified |
|---|---|---|---|
| S1 | https://raw.githubusercontent.com/krausest/js-framework-benchmark/master/webdriver-ts/src/timeline.ts | master ≈ f2df01a | yes — source read; end-event rule quoted |
| S2 | https://raw.githubusercontent.com/krausest/js-framework-benchmark/f2df01a8679de05225c32714ca8cecbea3d78c5d/webdriver-ts/src/forkedBenchmarkRunnerPuppeteer.ts | f2df01a | yes — source read; fresh page per iteration, GC placement |
| S3 | https://raw.githubusercontent.com/krausest/js-framework-benchmark/f2df01a8679de05225c32714ca8cecbea3d78c5d/webdriver-ts/src/benchmarksPuppeteer.ts | f2df01a | yes — swap/run init+run quoted |
| S4 | https://raw.githubusercontent.com/krausest/js-framework-benchmark/f2df01a8679de05225c32714ca8cecbea3d78c5d/webdriver-ts/src/puppeteerAccess.ts | f2df01a | yes — launch args; headed by default |
| S5 | https://raw.githubusercontent.com/krausest/js-framework-benchmark/f2df01a8679de05225c32714ca8cecbea3d78c5d/webdriver-ts/src/common.ts | f2df01a | yes — 15 iterations, Puppeteer default |
| S6 | https://raw.githubusercontent.com/krausest/js-framework-benchmark/f2df01a8679de05225c32714ca8cecbea3d78c5d/webdriver-ts/src/stats.ts | f2df01a | yes — descriptive only, no test |
| S7 | https://raw.githubusercontent.com/krausest/js-framework-benchmark/f2df01a8679de05225c32714ca8cecbea3d78c5d/webdriver-ts-results/src/Common.ts | f2df01a | yes — t-test found here, not in runner; corrected "no statistics" reading of S6 |
| S8 | https://raw.githubusercontent.com/krausest/js-framework-benchmark/f2df01a8679de05225c32714ca8cecbea3d78c5d/webdriver-ts/src/benchmarksCommon.ts | f2df01a | yes — warm-ups, throttling map |
| S9 | https://raw.githubusercontent.com/krausest/js-framework-benchmark/f2df01a8679de05225c32714ca8cecbea3d78c5d/README.md | f2df01a | yes — visible-window warning, `build-prod` |
| S10 | https://raw.githubusercontent.com/google/tachometer/705d64846f8ffc67981eab9fb240cf2cb222d6db/src/stats.ts | 0.7.2 | yes — `computeDifference`, df rule quoted |
| S11 | https://raw.githubusercontent.com/google/tachometer/705d64846f8ffc67981eab9fb240cf2cb222d6db/README.md | 0.7.2 | yes — read; external URL ⇒ FCP only changed the page-hosting plan |
| S12 | https://raw.githubusercontent.com/google/tachometer/705d64846f8ffc67981eab9fb240cf2cb222d6db/src/browser.ts | 0.7.2 | yes — Selenium, throttle, trace prefs |
| S13 | https://api.github.com/repos/google/tachometer/commits?per_page=3 | 705d648 | yes — last commit 2025-07-03 |
| S14 | https://registry.npmjs.org/tachometer/latest | 0.7.2 | yes — version, gitHead, `jstat` dep |
| S15 | https://raw.githubusercontent.com/angular/angular/846c73d52be8104aea826da5d4d95814fd24b117/modules/utilities/perf_util.ts | 846c73d | yes — full file read |
| S16 | https://raw.githubusercontent.com/angular/angular/846c73d52be8104aea826da5d4d95814fd24b117/modules/benchmarks/src/js-web-frameworks/js-web-frameworks.perf-spec.ts | 846c73d | yes — full file read |
| S17 | https://raw.githubusercontent.com/angular/angular/846c73d52be8104aea826da5d4d95814fd24b117/modules/benchmarks/src/js-web-frameworks/BUILD.bazel | 846c73d | yes — Protractor dep |
| S18 | https://raw.githubusercontent.com/angular/angular/846c73d52be8104aea826da5d4d95814fd24b117/modules/benchmarks/README.md | 846c73d | yes — sample size, env vars |
| S19 | https://raw.githubusercontent.com/angular/angular/846c73d52be8104aea826da5d4d95814fd24b117/packages/benchpress/README.md | 846c73d | yes — metrics, validators, forceGc caveat |
| S20 | https://registry.npmjs.org/@angular/benchpress/latest | 0.3.0 | yes — EOL notice |
| S21 | https://raw.githubusercontent.com/angular/angular/846c73d52be8104aea826da5d4d95814fd24b117/.github/workflows/benchmark-compare.yml | 846c73d | yes — ubuntu-latest, comment |
| S22 | https://raw.githubusercontent.com/lit/lit/01dbc6673cdc211543932afd0ca04e223e567366/packages/benchmarks/lit-html/repeat/tachometer.json | 01dbc66 | yes — full config read |
| S23 | https://raw.githubusercontent.com/lit/lit/01dbc6673cdc211543932afd0ca04e223e567366/.github/workflows/benchmarks.yml | 01dbc66 | yes — PR trigger, artifact only |
| S24 | https://raw.githubusercontent.com/lit/lit/01dbc6673cdc211543932afd0ca04e223e567366/.github/workflows/benchmarks-report.yaml | 01dbc66 | yes — comment, no failing check |
| S25 | https://raw.githubusercontent.com/lit/lit/01dbc6673cdc211543932afd0ca04e223e567366/packages/benchmarks/package.json | 01dbc66 | yes — `tach` scripts, `tachometer ^0.7.0` |
| S26 | https://raw.githubusercontent.com/preactjs/preact/8101ff821690817c7786739c317af215c62a0cff/.gitmodules | 8101ff8 | yes — `benchmarks` is a submodule; the in-repo path is empty |
| S27 | https://raw.githubusercontent.com/preactjs/benchmarks/ec93e1bf79f97c6aa6e0e7cbb7b4afd760669d5f/README.md | ec93e1b | yes — CLI defaults |
| S28 | https://raw.githubusercontent.com/preactjs/benchmarks/main/package.json | main ≈ ec93e1b | yes — patched `tachometer@0.7.0`; patch not opened |
| S29 | https://raw.githubusercontent.com/preactjs/benchmarks/ec93e1bf79f97c6aa6e0e7cbb7b4afd760669d5f/cli/package.json | ec93e1b | yes — `tachometer`, `jstat` deps |
| S30 | https://raw.githubusercontent.com/preactjs/benchmarks/ec93e1bf79f97c6aa6e0e7cbb7b4afd760669d5f/apps/table-app/reorder1k.html | ec93e1b | yes — script quoted verbatim |
| S31 | https://raw.githubusercontent.com/preactjs/benchmarks/ec93e1bf79f97c6aa6e0e7cbb7b4afd760669d5f/apps/utils.js | ec93e1b | yes — `afterFrameAsync`, `markRunEnd` |
| S32 | https://unpkg.com/afterframe@1.0.2/dist/afterframe.module.js | 1.0.2 | yes — minified source read; rAF + MessageChannel |
| S33 | https://browserbench.org/Speedometer3.1/about.html | 3.1 | yes — sync/async method; aggregation not on page |
| S34 | https://raw.githubusercontent.com/ChromeDevTools/devtools-frontend/main/front_end/models/trace/types/TraceEvents.ts | main (unpinned) | yes — `EventTiming`, `AnimationFrame` defs |
| S35 | https://web.dev/articles/manually-diagnose-slow-interactions-in-the-lab | updated 2024-10-17 | yes — page read |
| S36 | https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/pdl/domains/Tracing.pdl | master (unpinned) | yes — `transferMode`, `tracingComplete.stream` |
| S37 | https://angular.dev/errors/NG0100 | Angular docs, fetched 2026-09-25 | yes — dev-mode extra check quoted |
| S38 | https://angular.dev/api/core/isDevMode | Angular docs, fetched 2026-09-25 | yes — `optimization` disables dev mode |
| S39 | https://angular.dev/best-practices/profiling-with-chrome-devtools | Angular docs, fetched 2026-09-25 | yes — "exclusively in development mode" |
| S40 | https://raw.githubusercontent.com/mozilla/treeherder/master/treeherder/perfalert/perfalert/__init__.py | master ≈ 737610f | yes — `detect_changes` defaults, Welch t |
| S41 | https://raw.githubusercontent.com/mozilla/treeherder/master/treeherder/config/settings.py | master ≈ 737610f | yes — 2 % threshold, windows |
| S42 | https://raw.githubusercontent.com/mozilla/treeherder/master/treeherder/perf/alerts.py | master ≈ 737610f | yes — magnitude check after t |
| S43 | https://raw.githubusercontent.com/catapult-project/catapult/main/dashboard/dashboard/pinpoint/models/compare/compare.py | main ≈ 6fd8bbe | yes — KS+MWU, three-way result |
| R1 | libs/table/src/directives/ngp-table-row-animation.bench.spec.ts:258 | working tree | yes — `sampleReorder`, min gates |
| R2 | libs/table/src/directives/ngp-table-row-animation.directive.ts:83 | working tree | yes — `afterRenderEffect` earlyRead/write |
| R3 | libs/table/project.json:63 | working tree | yes — `bench` target |
| R4 | apps/site/project.json:9 | working tree | yes — `@angular/build:application`, `serve-static` |
| R5 | package.json:74 | working tree | yes — `playwright ^1.63.0`, `vitest 4.1.9`, `@angular/core 22.1.2` |
| R6 | node_modules/playwright-core/types/types.d.ts:11750 | 1.63.0 (node_modules/playwright-core/package.json) | yes — `startTracing`, `newCDPSession` |
| R7 | node_modules/@angular/build/src/builders/unit-test/schema.json:7 | 22.1.2 | yes — `buildTarget` defaults to `development` |
| R8 | libs/table/docs/3-ui/work/row-animation/discovery-benchmark-thresholds.md | 2026-09-24 | yes — sibling discovery; AG Grid, Handsontable, headless, throttle, Vitest v4 claims carried from there |
| R9 | handoffs/handoff-row-animation-bench.md | 2026-09-25 | yes — timeline and trace findings |
