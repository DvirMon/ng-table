# Decisions — Sidebar Navigation

**Desktop-only this pass.** User confirmed scope: container + section labels + nav-item rows + sticky
positioning + mock data + real `<a>` tags. Mobile drawer (trigger, scrim, close button, focus trap) is a
separate follow-up — it needs `navbar`'s hamburger button wired with a `(click)` handler it doesn't have
today, plus the scrim recipe from `foundations/Radius and Elevation.md`, which wasn't pulled into scope
this pass.

**`sections`/`root`/`activeSlug` as inputs with mock defaults**, not hardcoded content like
`home.content.ts`. Reasoning: `home.content.ts` is page-local one-off marketing copy; this is a reusable
docs-shell organism, matching the `tab-switcher`/`pagination`/`dropdown-menu` precedent of taking data via
`input()` with `.mock.ts` supplying the demo default.

**`archetype` dropped from `NavEntry`.** The seed tree in `Content Model.md` carries it (`"Doc Article"`
for every entry, `"Section Landing"` for the root), but nothing in this component's rendering reads it —
every entry renders as a `nav-item` row regardless of its target page's archetype. Re-add it if/when a
consumer (e.g. active-state resolution against `Routing and Page State.md`) needs it.

**`nested` bound identically to `active`**, not carried as a per-entry data field. Per `nav-item.css`,
`[data-nested]` only visibly does anything combined with `[data-active]` (the accent treatment on the
current row) — it's not an independent property of any given entry.

**Router wiring added 2026-08-25.** `app.routes.ts` now registers `overview` and a generic `:section/:entry`
route, both pointing at `DocPlaceholder` (`pages/doc-placeholder/`) — a stand-in for the real Doc
Article/Section Landing archetypes, which aren't built yet. Sidebar rows use `[routerLink]` instead of
`[href]`; `activeSlug` is still a plain input, not resolved from the router — the caller (`DocPlaceholder`)
derives it from `ActivatedRoute` and passes it down, since `Routing and Page State.md`'s full page-state
object isn't implemented.

**Entry counts, from the fenced seed-tree block directly** (not the surrounding prose, which undercounted):
State Layer 11, Columns 7, UI Layer 12 (one hidden: "Row Reorder Animation" — not implemented, per its own
source doc's `status: draft`).

**No `sidebar-navigation` row added to `CONVENTIONS.md`'s fixed contract table** — flagged as a suggestion
for a follow-up, not self-edited as part of this task.

**`/docs` prefix dropped from every slug (2026-08-25).** User request, overriding `Content Model.md`'s
original zone-separation rule (kept the `/docs` prefix specifically to give a mechanical path-based test
between the marketing zone and the docs zone). Docs root moved from `/docs` to `/overview` to avoid
colliding with Home's `/`. `Content Model.md` § Slug prefix now documents the trade-off: zone resolution
needs an explicit tree lookup instead of a prefix check — `Routing and Page State.md` isn't updated yet to
reflect that, flag before relying on it.
