# Is OXC-family tooling (oxlint/oxfmt) worth adopting for CI speed here — and what else is?

**Date:** 2026-09-17 · **Depth:** standard · Scope-sibling of [`ci-production-readiness.md`](ci-production-readiness.md) (Nx affected, Nx Cloud, DTE, CodeQL, Pages — not repeated here).

## Answer

**No — not today, and not primarily because oxlint is immature.** Every rule category this repo actually
depends on is one oxlint cannot own: Angular template rules over 81 `.html` files [S1][R3], the
`@angular-eslint` selector rules that enforce ADR-0005's `ngpt` prefix [R4], and
`@nx/enforce-module-boundaries` [R2]. ESLint keeps running either way, so oxlint adds a second linter
rather than removing one. Oxlint's type-aware mode is a separate dead end here: it requires TypeScript
7.0+ [S3], and `@angular/compiler-cli@22.1.2` peer-pins `typescript >=6.0 <6.1` [S9][S10].
**And lint is not the bottleneck** — on the only green CI run to date, `npm ci` took 28s of 62s while
`lint typecheck` took 9s [P1].

## Method

- Versions pinned from the installed `package.json` [R7] and the npm registry: `oxlint@1.83.0`
  (published 2026-09-14) [S8], `typescript@7.0.2` latest vs `6.0.3` installed, `nx@23.1.1` installed.
- Step timings read with `gh api repos/DvirMon/ng-table/actions/runs/<id>/jobs` on 2026-09-17 [P1].
- **Reliability:** the CI workflow is 3 runs old and the one green run was a lockfile-only commit, so
  every Nx target hit "nothing affected"/cache. The 9s lint+typecheck figure is a *floor*, not a
  representative code-change run. `npm ci`'s 28s does not vary with affected-set size, so that half of
  the measurement transfers; the task half does not.

## Evidence — oxlint coverage against this repo's actual rule set

| Rule category in use | Source | Movable to oxlint? |
|---|---|---|
| `js.configs.recommended` + `typescript-eslint` **recommended** (non-type-checked) | [R8] | Yes — oxlint ships 865+ rules across eslint/typescript plugins [S6] |
| `@angular-eslint` `tsRecommended` + repo's `component-selector`/`directive-selector` (ADR-0005 `ngpt` prefix) | [R4] | No first-class support; only via alpha `jsPlugins` running the real ESLint plugin in JS [S5] |
| `@angular-eslint/template` recommended + accessibility, on `**/*.html` (81 files) | [R3][P2] | **No.** "No template linting yet" for Angular [S1]; custom parsers explicitly unsupported in JS plugins [S5] |
| `@nx/enforce-module-boundaries` (two configs, `scope:shared` constraint) | [R2] | Not ported; would need the alpha jsPlugins path [S5] |
| Type-aware rules | none configured [R8] | N/A — nothing to migrate, and TS 7.0+ is required anyway [S3] |

So ~2 of 5 categories are portable, and the 3 that are not are the ones carrying this repo's
project-specific invariants.

## Levers

| Lever | Verdict | Rationale |
|---|---|---|
| Replace ESLint with oxlint | **skip** | Templates, `@angular-eslint` selectors and `enforce-module-boundaries` all stay on ESLint [S1][R2][R4]; oxlint would be additive cost |
| Run oxlint *alongside* ESLint (`@nx/oxlint`) | **not-yet** | Nx ships it in **23.2** (repo is on 23.1.1 [R7]) as experimental, needs oxlint ≥1.70.0, and Nx itself says ESLint is still required for JSON/HTML/Angular templates [S7] |
| oxlint `--type-aware` as a `tsc --noEmit` replacement | **skip** | oxc pitches exactly this [S3], but it needs TS 7.0+ [S3][S4] and Angular 22 pins TS 6.0.x [S9]; also this repo needs `ngc`, not `tsc`, so type-aware lint could never have replaced the typecheck step |
| oxfmt instead of Prettier | **skip** | CI runs no format check at all [R1] — there is zero CI time to reclaim |
| Speed up `npm ci` (`--prefer-offline --no-audit --fund=false`) | **worth-it-now** | It is the single largest measured step, 28s of 62s [P1]; flags are a one-line change with no lockfile or tooling migration |
| Migrate npm → pnpm | **not-yet** | Plausible win on the largest step, but unverified for this repo (see Unverified) and it touches the lockfile, Nx config and every CI workflow — poor ratio for a solo repo until the 28s is measured as a real constraint |
| Drop `nx affected -t typecheck`, rely on `build` | **skip** | Verification overturned this: `build` enters at `src/index.ts` [R5], while `typecheck` uses `tsconfig.lib.json`'s `include: src/**/*.ts` [R6] — which is the only thing covering `src/stories/**/*-story-host.component.html`, the repo's own stated highest-risk template surface |
| Drop `nx affected -t build` for the **lib** instead | **not-yet** | `build` and `typecheck` both run the Angular compiler over `tsconfig.lib.json` [R5], and CI publishes nothing [R1] — but `build` still catches bundling/budget errors for the app. Measure the two steps on a real code change before cutting either |
| Jest → Vitest | **already done** | `vitest@4.1.9` + `@nx/vitest` are already the runner [R7]; no lever remains |
| swc-based transpile for tests | **already done** | `@swc/core` + `@swc-node/register` are installed [R7], and Vite/esbuild already handles test transform — swc never type-checks, so it cannot touch the `ngc` step |
| Angular typecheck via tsgo | **not-yet** | The 10x typecheck win rides on TS 7; Angular needs a compiler refactor plus TS 7.1's stabilised API before its peer range widens [S10]. Nothing to do but wait for an Angular 22.x minor |

## Synthesis

The three sources disagree about oxlint's positioning, and the disagreement is the decision. **oxc**
says "Replace ESLint (recommended for most projects)" [S6]. **Nx** says "You don't have to switch
everything at once. Oxlint is designed to run next to ESLint" and names Angular templates as an ESLint-
only surface [S7]. **angular-eslint** says porting is blocked on generic parser support, postponed to
"26Q3 or even after 26Q4" [S2]. oxc's framing is written for a JS/TS repo; for a framework repo with a
custom template AST, Nx's and angular-eslint's framing is the accurate one. The general question behind
all of this — *is the linter the bottleneck?* — is answerable from the repo's own run data, and the
answer is no [P1].

Second: the TS 6-vs-7 pin is one constraint producing three separate "not yet" answers (oxlint
type-aware, tsgo typecheck, and any tsgolint-backed tooling). It resolves in one event — Angular
widening its peer range after TS 7.1 [S10] — not in three independent decisions.

## Against

- oxlint's `jsPlugins` *is* ESLint-v9-API-compatible, so `@angular-eslint/eslint-plugin` TS rules and
  `@nx/eslint-plugin` could in principle load into oxlint today [S5]. Two reasons not to: it is alpha
  [S5], and rules executed as JS in oxlint forfeit the Rust speed that was the entire premise.
- oxlint is not a slow-moving target. 1.83.0 shipped 2026-09-14 [S8] and type-aware linting reached
  59/61 typescript-eslint rules and a stable label [S3][S4]. This verdict has a short shelf life —
  re-check when Angular's TS peer range widens, which is the same event that unblocks it.

## Not researched

- Whether Nx Cloud remote caching would make the lint/typecheck steps free regardless — owned by
  [`ci-production-readiness.md`](ci-production-readiness.md).
- Storybook build time in CI (`build-storybook` is not in the workflow [R1], so it costs nothing today).
- Biome as a third option; the question named the OXC family specifically.
- Local wall-clock timings for `lint`, `typecheck` and `build` — not measured, because running them
  unprompted is out of scope per this repo's rules.

## Unverified

- **pnpm's CI advantage over `npm ci` for this repo.** Published 2026 benchmarks claim ~2.5x on the
  warm-cache CI case, but every source found was an SEO comparison page with no reproducible method,
  not a primary benchmark — not citable, and not transferable to a 2-project workspace. What would
  confirm it: one branch switching the workflow to `pnpm/action-setup` and comparing the install step
  against the 28s baseline [P1].
- **oxfmt's maturity.** Reported as beta with 100% Prettier JS/TS conformance, from a search snippet
  only — not opened, and moot here since CI runs no format check [R1].
- Whether `npm ci --prefer-offline` actually helps given `actions/setup-node`'s npm cache is already
  enabled [R1]. Reasonable inference, not a measured result; the same branch that tests pnpm settles it.

## Sources

| | Source | Version | Verified |
|---|---|---|---|
| S1 | https://oxc.rs/compatibility.html | oxlint 1.83.0 | yes — "Vue, Svelte, Angular, Ember, Nuxt, Astro, SvelteKit, and Analog: No template linting yet" |
| S2 | https://github.com/angular-eslint/angular-eslint/discussions/2062 | — | yes — JamesHenry 2024-10-09 ("very unlikely that oxc will be supporting parsing Angular flavored HTML any time soon"); Shinigami92 2026-08-17 postpones to 26Q3/Q4 |
| S3 | https://oxc.rs/docs/guide/usage/linter/type-aware.html | oxlint 1.83.0 | yes — 59/61 rules; "TypeScript **7.0+** is required"; `baseUrl` unsupported; pitched as replacing "a separate `tsc --noEmit` step in CI" |
| S4 | https://github.com/oxc-project/tsgolint | — | yes — "59/61 targeted `typescript-eslint` type-aware rules implemented"; built on typescript-go / TS 7 |
| S5 | https://oxc.rs/docs/guide/usage/linter/js-plugins.html | oxlint 1.83.0 | yes — "JS plugins are currently in alpha"; ESLint v9+ compatible; custom parsers (Angular) and type-aware rules unsupported |
| S6 | https://oxc.rs/docs/guide/usage/linter | oxlint 1.83.0 | yes — "50 to 100 times faster than ESLint"; 865+ rules; "Replace ESLint (recommended for most projects)" |
| S7 | https://nx.dev/blog/nx-23-2-release | nx 23.2 | yes — `@nx/oxlint` experimental; "needs Oxlint 1.70.0 or later"; "Oxlint is designed to run next to ESLint"; ESLint still needed for JSON/HTML/Angular templates |
| S8 | `npm view oxlint version time.modified` | 1.83.0 (2026-09-14) | yes — ran it |
| S9 | `npm view @angular/compiler-cli@22.1.2 peerDependencies` | 22.1.2 | yes — `{"typescript": ">=6.0 <6.1"}` |
| S10 | https://github.com/angular/angular/issues/69704 | — | yes — closed/locked; JeanMeche 2026-07-09: "Supporting TS 7.0, requires a major refactoring of our compiler… ts 7.0 doesn't ship stabilised API" |
| P1 | `gh api repos/DvirMon/ng-table/actions/runs/35224434933/jobs` | run of 2026-09-17 | yes — ran it: npm ci 28s, lint+typecheck 9s, test 7s, build 8s, job total 62s |
| P2 | `find libs apps -name "*.html"` / `-name "*.ts"` | — | yes — ran it: 81 `.html`, 296 `.ts` |
| R1 | `.github/workflows/ci.yml` | — | yes — read; no format check, no build-storybook step |
| R2 | `eslint.config.mjs` (root) | — | yes — read; `@nx/enforce-module-boundaries` |
| R3 | `node_modules/@nx/eslint-plugin/dist/src/flat-configs/angular-template.js` | @nx/eslint-plugin 23.1.1 | yes — read; `templateRecommended` + `templateAccessibility` on `**/*.html` |
| R4 | `apps/site/eslint.config.mjs` | — | yes — read; `@angular-eslint/component-selector`, `directive-selector`, `ngpt` prefix |
| R5 | `libs/table/project.json` | — | yes — read; `typecheck` = `ngc -p tsconfig.lib.json --noEmit`; `build` = `@angular/build:application`, same tsConfig, browser entry `src/index.ts` |
| R6 | `libs/table/tsconfig.lib.json` | — | yes — read; `"include": ["src/**/*.ts"]` |
| R7 | `package.json` | — | yes — read; typescript 6.0.3, vitest 4.1.9, nx 23.1.1, @swc/core 1.15.8 |
| R8 | `node_modules/@nx/eslint-plugin/dist/src/flat-configs/typescript.js` | @nx/eslint-plugin 23.1.1 | yes — read; `typescript-eslint.configs.recommended`, **not** `recommendedTypeChecked` — no type-aware rules configured |
