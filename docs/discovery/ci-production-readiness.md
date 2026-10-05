# Is "nx affected + lint/test/build" sufficient CI for a solo Nx/Angular repo?

**Date:** 2026-09-17 · **Depth:** standard

## Answer

**No — but nothing on the "production-grade CI" list is what's missing.** The current workflow is
structurally right (Nx's own recommended shape minus Nx Cloud) and three of its four checks are
weak or dead: `build` excludes both projects in a 2-project workspace, so that line runs nothing
[R1][P1]; `typecheck` exists as a target on both projects and never runs in CI [R3], despite this
repo's own rule recording a template bug that plain `tsc` shipped [R5]; `llms:check` is documented
as "must stay clean" and is unenforced [R4]. Fix those three and add `concurrency` — that is the
whole gap. Caching, Nx Cloud, and DTE are optimizations for a workspace this size, not correctness
[S2]. `concurrency` is still worth adding (faster feedback on superseded pushes), but not for
budget reasons: **the repo is public** [P2-corrected], and public repos get unlimited free GitHub
Actions minutes [S11] — the 2,000 min/month Free-tier cap this doc originally cited does not apply.
Public visibility also unlocks two rows that were previously "skip while private": CodeQL (R13) and
GitHub Pages (R16).

## Method

- Pinned from the installed workspace: `nx@23.1.1`, `@angular/core@22.1.2` (root `package.json`).
- Nx docs re-fetched at current URLs — the `nx.dev/ci/recipes/...` paths in older guidance now 404;
  live pages are under `nx.dev/docs/...`. `nx.json`, both `project.json`, both workflows read
  directly [R1][R2][R3].
- Repo visibility probed with `gh repo view --json visibility` → `PRIVATE` at research time [P2].
  **Correction (2026-09-17, same day):** the user confirmed the repo is actually **public**;
  `gh api repos/DvirMon/ng-table` also now returns `"visibility":"public"`. Every plan-gated row
  below was re-checked against public visibility; see the corrected rows in Inventory.
- Reliability: Nx's **own** CI page is written for an Nx-Cloud-connected workspace and presents no
  non-Cloud variant [S1]. Read it as a product recommendation, not a neutral baseline.

## Evidence

- Nx's current recommended GH Actions workflow is `checkout@v7` / `setup-node@v6` / node 24, plus
  `npx nx-cloud start-nx-agents` and `npx nx fix-ci` — and contains **no** `nx-set-shas` step,
  because Nx Cloud supplies the base SHA [S1].
- That page offers **one** workflow and draws no distinction by team or repo size [S1].
- Nx Cloud **Hobby is free**: 50,000 credits/month, 5 contributors, 10 concurrent CI connections,
  and it includes both Nx Replay (remote cache) and Nx Agents [S3].
- Distribution's own stated trigger is scale: "Once the affected set outgrows one machine, the next
  win has to come from more machines" [S2].
- Nx 21 removed the legacy file cache for a database cache; `NX_REJECT_UNKNOWN_LOCAL_CACHE`
  "does not work with the new database cache" and is documented as "Not supported" [S4][S5].
- The familiar `actions/cache` failure — "The local cache artifact … was not generated on this
  machine … cache restoration potentially unsafe" — is reported against caching `.nx/cache` alone
  [S6].
- Caching `.nx/cache` **plus** `.nx/workspace-data/*.db*` fixes it: the db filename derives from
  `/etc/machine-id`, which GitHub-hosted runners share. A probe on a fresh runner restored
  `58b34b8c91a94400a52c175421986a53-v3.db` saved by a different runner [S7].
- CVE-2025-36852 (CREEP, 9.4) poisons bucket-backed remote caches: "whichever branch or PR first
  uploads a build artifact for a particular source file state will have its version used
  everywhere … including production deployments" [S8]. Nx's stated mitigation is branch scoping —
  "Feature branches can only write to their own isolated, branch-scoped caches" [S8].
- GitHub Actions caches are already scoped that way: a PR-run cache is created for the merge ref and
  "can only be restored by re-runs of the pull request"; main cannot restore a PR's cache [S9].
- `nx.json` lists `.github/workflows/ci.yml` under `sharedGlobals`, so the workflow file is an input
  to every task hash [R2] — the input CREEP exploits being absent.

## Comparison — the two caching options at this scale

| Axis                          | `actions/cache` on `.nx`                                                              | Nx Cloud Hobby            |
| ----------------------------- | ------------------------------------------------------------------------------------- | ------------------------- |
| Cost                          | free, 10 GB/repo quota [S11]                                                          | free: 50k credits/mo [S3] |
| Works on nx@23.1.1            | only if `.nx/workspace-data/*.db*` is cached too [S7]; `.nx/cache` alone fails [S6]   | zero-config [S3]          |
| Escape hatch if it misbehaves | none — `NX_REJECT_UNKNOWN_LOCAL_CACHE` is dead on the db cache [S4][S5]               | n/a                       |
| CREEP exposure                | mitigated by GitHub's merge-ref cache scoping [S9] + `ci.yml` in `sharedGlobals` [R2] | mitigated by design [S8]  |
| Eviction                      | 7 days idle, 10 GB/repo [S9]                                                          | credit-metered [S3]       |
| Nx's own recommendation       | not documented as an option [S1]                                                      | yes [S1][S3]              |

## Inventory — candidate additions

|     | Addition                                                                       | Verdict                       | Rationale                                                                                                                                                           | Source         |
| --- | ------------------------------------------------------------------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| R1  | Run `nx affected -t typecheck`                                                 | **worth it for solo**         | Target exists on both projects and never runs; `tsc` never opens a template, and that gap shipped bug #60 in this repo                                              | [R3][R5]       |
| R2  | Drop the `build --exclude=shared-table,ng-table`                               | **worth it for solo**         | Only two projects exist, so the exclusion list is the whole workspace — the line is a no-op wearing a green check                                                   | [R1][P1]       |
| R3  | Add `npm run llms:check` (and `table:overloads:check`)                         | **worth it for solo**         | CLAUDE.md declares `llms:check` "must stay clean"; an unenforced invariant drifts                                                                                   | [R4]           |
| R4  | `concurrency: ${{ github.workflow }}-${{ github.ref }}` + `cancel-in-progress` | **worth it for solo**         | Public repo → unlimited free minutes, so this isn't a quota fix; still worth it for faster feedback — a superseded push shouldn't leave a stale run queued/running  | [S10][S11][P2] |
| R5  | Bump `nx-set-shas` v4 → v5                                                     | **worth it for solo**         | v5 is current (node24 runtime); one-line, no behavior change                                                                                                        | [S12]          |
| R6  | `setup-node` `cache: 'npm'`                                                    | **already done**              | Present in the workflow today; this is the highest-value cache at this size                                                                                         | [R1]           |
| R7  | `actions/cache` on `.nx/cache` + `.nx/workspace-data/*.db*`                    | **situational**               | Correct and safe here, but with 2 projects `affected` rarely narrows anything and `npm ci` + Angular build dominate — measure before adding                         | [S7][S9][S2]   |
| R8  | Nx Cloud Hobby (Nx Replay remote cache)                                        | **situational**               | Free and zero-config, and Nx's own answer; the trade is a third-party dependency for a cache whose hit rate at 2 projects is unproven                               | [S3][S1]       |
| R9  | Nx Agents / DTE                                                                | **skip until team grows**     | Its documented trigger is an affected set that outgrows one machine; two projects never will                                                                        | [S2]           |
| R10 | `nx fix-ci` (self-healing)                                                     | **skip until team grows**     | Requires the Nx Cloud connection and exists to unblock reviewers you don't have                                                                                     | [S1][S3]       |
| R11 | Dependabot version updates                                                     | **worth it for solo**         | Config-only, `groups` + `open-pull-requests-limit` keep PR volume to one batch; the solo failure mode is silently rotting deps, not too many PRs                    | [S15]          |
| R12 | Renovate instead of Dependabot                                                 | **situational**               | Only if grouped-Angular-major batching becomes painful; adds an external app to a private repo                                                                      | [S15]          |
| R13 | CodeQL / code scanning                                                         | **worth it for solo**         | Needs public visibility or paid GitHub Code Security [S13]; the repo is public, so it's free — default setup is a few clicks, no workflow authoring                 | [S13][P2]      |
| R14 | Library publish + versioning workflow                                          | **skip for now**              | `libs/table` has no `package.json` and no packaging target — nothing to publish yet                                                                                 | [R3]           |
| R15 | npm trusted publishing (OIDC) when R14 happens                                 | **worth it, when it applies** | Removes the long-lived `NPM_TOKEN` and emits provenance by default — strictly better than a secret on day one                                                       | [S14]          |
| R16 | Storybook deploy to GitHub Pages                                               | **situational**               | Pages on Free needs public visibility [S16], which this repo has — no plan blocker. Worth it once there's a docs site worth publishing; not a correctness gap today | [S16][P2]      |
| R17 | Coverage reporting / thresholds                                                | **skip until team grows**     | Coverage gates exist to police contributors you can't review; solo, the number is information you already have locally                                              | —              |
| R18 | Artifact upload (Storybook build, dist)                                        | **situational**               | 500 MB artifact storage on Free; useful only to eyeball a built docs site from a PR                                                                                 | [S11]          |
| R19 | Merge queue                                                                    | **skip until team grows**     | Its purpose is serializing concurrent merges from multiple authors                                                                                                  | [S2]           |

## Synthesis

- **Nx's docs and this repo's scale disagree, and the docs know it.** `setup-ci` presents a single
  Cloud-connected workflow with no size axis [S1], while `monorepo-ci-best-practices` scales its
  own advice by affected-set size and project count [S2]. The second page is the honest one; read
  the first as the funnel it is. The current workflow is the non-Cloud shape of exactly that
  recommendation, and it is not wrong.
- **The `actions/cache` question has two contradicting sources and both are right.** The failure
  report [S6] and the working config [S7] differ only in whether `.nx/workspace-data/*.db*` is in
  the cache path. The db cache did not break CI caching; it moved the index, and most published
  guidance still names the old path. This is the finding source verification changed: the
  documented escape hatch for that error no longer exists on nx@23 [S4][S5], so getting the path
  right is the only remedy.
- **CREEP does not transfer to `actions/cache` here, for two independent reasons.** Nx's own stated
  mitigation is branch-scoped writes [S8], which is GitHub's default cache behavior, not an opt-in
  [S9]. And CREEP's premise — the CI workflow is not part of the cache key — is false in this
  workspace, since `ci.yml` sits in `sharedGlobals` [R2]. Either alone closes it. The deprecation
  applies to the bucket-backed plugins, not to a provider cache action.
- **Solo changes which practices pay, not how much rigor is warranted.** Every _skip_ row is a
  **coordination** control (coverage gates, merge queues, self-healing comments, review-blocking
  scans); every _worth it_ row is a **correctness or quota** control. That line is cleaner than
  "lean vs. production-grade" — R1–R3 are not concessions, they are checks the repo already
  documents as required and does not run.

## Against

- R7/R8 being "situational" rests on an unmeasured assumption that `npm ci` + a cold Angular build
  dominate the run. If the Angular build and Storybook build are the bulk of wall time, a warm Nx
  cache is the single largest minute-saver available on a 2,000-minute budget, and R8 costs nothing
  to try [S3].
- Nx Cloud Hobby also supplies the base SHA, which would let the workflow drop `nx-set-shas`
  entirely [S1] — a small simplification the "skip" framing hides.

## Not researched

- Actual wall-clock time of the current CI run, and the split between `npm ci`, lint, test, build.
  No run was inspected; every cache-value claim here is analytical, not measured.
- Whether the `test --exclude=ng-table` exclusion is still needed — the comment calls it temporary,
  and the underlying failure was not reproduced.
- Self-hosted runners, Nx's custom remote-cache OpenAPI server, and non-GitHub CI providers.
- Renovate's own docs and its private-repo pricing; R12 rests on the Dependabot comparison only.

## Unverified

- The GitHub Pages plan-availability sentence [S16] came back in a search snippet attributed to the
  docs; the plan banner did not render in the page fetch. Confirm from the repo's own
  Settings → Pages, which will simply not offer a source if the plan blocks it.
- The affected-package list for CVE-2025-36852 (`@nx/s3-cache`, `@nx/gcs-cache`, `@nx/azure-cache`,
  `@nx/shared-fs-cache`) and its 2026-05-21 deprecation date appeared only in search summaries; the
  Nx plugin overview pages now 404 and the blog post [S8] does not enumerate packages. The CVE's
  OSV entry would confirm. It does not change any verdict — none of those packages is in use.
- R17's rationale is judgment, not a sourced claim.

## Sources

|     | Source                                                                                                                    | Version         | Verified                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------- |
| S1  | https://nx.dev/docs/getting-started/setup-ci                                                                              | nx 23 docs      | yes — fetched; workflow reproduced, no team-size axis, no `nx-set-shas`                               |
| S2  | https://nx.dev/docs/kb/monorepo-ci-best-practices                                                                         | nx 23 docs      | yes — fetched; supplied the distribution threshold quote                                              |
| S3  | https://nx.dev/pricing                                                                                                    | read 2026-09-17 | yes — fetched; Hobby = 50k credits, 5 contributors, 10 connections                                    |
| S4  | https://nx.dev/docs/reference/deprecated/legacy-cache                                                                     | nx 23 docs      | yes — fetched; corrected the common claim that `NX_REJECT_UNKNOWN_LOCAL_CACHE` is a usable workaround |
| S5  | https://nx.dev/docs/reference/environment-variables                                                                       | nx 23 docs      | yes — fetched; "Not supported with the new database cache"                                            |
| S6  | https://github.com/nrwl/nx/discussions/30760                                                                              | —               | yes — fetched; exact error text                                                                       |
| S7  | https://github.com/exactly/exa/pull/1315                                                                                  | —               | yes — fetched; the `/etc/machine-id` probe that overturned S6's implication                           |
| S8  | https://nx.dev/blog/cve-2025-36852-critical-cache-poisoning-vulnerability-creep                                           | CVE-2025-36852  | yes — fetched; attack sequence + branch-scoping mitigation                                            |
| S9  | https://docs.github.com/en/actions/reference/dependency-caching-reference                                                 | —               | yes — fetched; merge-ref scoping, 10 GB, 7-day eviction                                               |
| S10 | https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#concurrency                            | —               | yes — fetched; group expression + `cancel-in-progress`                                                |
| S11 | https://docs.github.com/en/billing/managing-billing-for-your-products/about-billing-for-github-actions                    | —               | yes — fetched; 2,000 min / 500 MB / 10 GB on Free                                                     |
| S12 | https://github.com/nrwl/nx-set-shas/releases                                                                              | v5.0.1          | yes — fetched; v5 current, node24 runtime                                                             |
| S13 | https://docs.github.com/en/code-security/code-scanning/enabling-code-scanning/configuring-default-setup-for-code-scanning | —               | yes — fetched; public-or-Code-Security prerequisite                                                   |
| S14 | https://docs.npmjs.com/trusted-publishers                                                                                 | —               | yes — fetched; OIDC, `id-token: write`, automatic provenance                                          |
| S15 | https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference                  | —               | yes — fetched; `groups`, `open-pull-requests-limit`, `schedule.interval`                              |
| S16 | https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages                                   | —               | no — plan banner not present in fetched page; sentence from search snippet only                       |
| P1  | `git ls-files '**/project.json'` → 2 files                                                                                | —               | yes — ran it                                                                                          |
| P2  | `gh repo view --json visibility` → `PRIVATE`                                                                              | —               | yes — ran it                                                                                          |
| R1  | `.github/workflows/ci.yml`                                                                                                | —               | yes — read                                                                                            |
| R2  | `nx.json` — `namedInputs.sharedGlobals`                                                                                   | —               | yes — read                                                                                            |
| R3  | `libs/table/project.json` (targets incl. `typecheck`; no sibling `package.json`)                                          | —               | yes — read                                                                                            |
| R4  | `CLAUDE.md` — "`npm run llms:check` must stay clean"                                                                      | —               | yes — read                                                                                            |
| R5  | `.claude/rules/typecheck-angular-templates.md` — bug #60                                                                  | —               | yes — read                                                                                            |

</content>
</invoke>
