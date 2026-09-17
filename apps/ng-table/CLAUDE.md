# ng-table

Docs/marketing site for NGP Table. See [CONTEXT.md](CONTEXT.md) for what this app is, its zones, and the
glossary. See [docs/CONVENTIONS.md](docs/CONVENTIONS.md) before writing or editing any component, layout
region, or page block — it fixes selectors/inputs for every domain so they don't drift from each other.

## Stack

Angular 22, standalone + zoneless + `OnPush`, signals, new control flow, CSS (not SCSS). Mirrors
`apps/demo` — see that app's `project.json` for the target shapes this one follows.

## Commands

```bash
npx nx serve ng-table   # dev server, port 4202 (.claude/launch.json)
npx nx build ng-table
npx nx lint ng-table
npx nx test ng-table
```

Never build/serve/test unprompted — ask first.

## Docs map

- [CONTEXT.md](CONTEXT.md) — what this site is, zones, glossary, where every spec now lives
- [docs/CONVENTIONS.md](docs/CONVENTIONS.md) — the build contract (selectors, inputs, state pattern, icons)
- `docs/adr/` — app-level decisions (app-local DS, no barrels, token file layout, local icon providers)
- `docs/design-handoff/` — the parts of the original design bundle not yet distributed to a domain
  (the 5 archetypes and layout regions not built this round, plus site-level specs, frames, screenshots)
- Each domain's own `docs/spec.md` + `docs/decisions.md` — colocated with its code, per
  `.claude/rules/file-organization.md` § Domain-scoped docs

## Structure

```
src/app/design-system/<id>/   16 DS components, each with docs/spec.md + docs/decisions.md
src/app/layout/<id>/          navbar, page-footer
src/app/pages/home/           Home page composition + its page-local blocks (hero-band, feature-grid, install-row)
src/styles/tokens/            --ngpt-* custom properties, one file per foundations spec
src/styles/docs/              the 8 foundations specs
```

No barrels (ADR-0002) — import components directly from their file. No shared design-token library outside
this app; tokens are app-local, matching `apps/issa-landing`'s precedent, not `libs/shared/design-system`.
