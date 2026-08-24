---
id: search
kind: component
atomic: Organism
spec: specs/Search.md
frame: components/Search.dc.html
owns:
  - "Two surfaces: the navbar field and the ⌘K overlay"
  - "The shared keyboard-chip atom"
  - "Overlay scrim, panel, input row, result list, empty states, footer legend"
  - "Full keyboard model"
does_not_own:
  - "Search indexing/ranking — see Search Index.md"
depends_on:
  - "foundations/Radius and Elevation.md (shape)"
  - "foundations/Motion.md (motion)"
  - "foundations/Color.md (color)"
  - "foundations/Iconography.md (icons)"
  - "foundations/Typography.md (typography)"
states:
  - "field idle"
  - "field hover"
  - "field focus"
  - "overlay open"
  - "typing"
  - "results"
  - "no results"
  - "empty query"
  - "result hovered"
  - "result keyboard-selected"
a11y:
  - "role=\"dialog\" aria-modal; focus trapped, Escape closes and restores focus; results are an aria-activedescendant listbox"
tokens: [--ngpt-comp-search-field-width, --ngpt-comp-search-field-height, --ngpt-sys-space-250, --ngpt-sys-shape-corner-small, --ngpt-bg-raised, --ngpt-comp-control-border-default, --ngpt-comp-pill-border-hover, --ngpt-focus-ring, --ngpt-sys-icon-size-md, --ngpt-text-muted, --ngpt-sys-space-200, --ngpt-sys-typescale-code, --ngpt-sys-space-050, --ngpt-sys-shape-corner-extra-small, --ngpt-bg-code-chip, --ngpt-sys-scrim, --ngpt-sys-z-modal-scrim, --ngpt-sys-z-modal, --ngpt-comp-search-panel-width, --ngpt-comp-search-panel-max-height, --ngpt-bg-elevated, --ngpt-border-subtle, --ngpt-sys-shape-corner-medium, --ngpt-sys-elevation-level2, --ngpt-comp-search-input-height, --ngpt-sys-space-400, --ngpt-sys-typescale-body-large, --ngpt-text-primary, --ngpt-sys-typescale-label-small-alt, --ngpt-sys-space-300, --ngpt-sys-shape-corner-extra-small-alt, --ngpt-text-secondary, --ngpt-accent, --ngpt-bg-active, --ngpt-sys-motion-duration-slow, --ngpt-sys-motion-easing-decelerate]
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

> Distributed here from the design handoff bundle (`apps/ng-table/docs/design-handoff/`) during Wave 0 spec distribution — spec wins over the reference frame there.

> **2026-08-23 revision:** row icons, active-row fill, border-radius, footer glyphs, 5-item cap,
> field focus treatment, input-row well, hairline shadow, group-label color, row/input height,
> trailing icon size, scrim, no-results parity, and the unified recent/result listbox all updated
> against a live scrape of the Angular Primitives (Algolia DocSearch) reference overlay, and the
> component code now matches this revision. See `docs/gaps-ngp-reference.md` for the scrape
> evidence and `docs/decisions.md` for the implementation record. Item 6 (field focus-ring a11y
> sign-off) remains open.

# Search

**Atomic level:** Organism

Two surfaces, one feature: a persistent field in the navbar, and the ⌘K overlay it opens. The field never returns results inline — clicking or focusing it opens the overlay, so there is exactly one result UI to build and maintain.

Depends on `foundations/Radius and Elevation.md` (scrim, z-index, elevated surface) and `foundations/Motion.md` (overlay timings).

## Surface 1 — Navbar field

Sits in the navbar's right group, before the Sponsor pill. Below `md` (1024px) it collapses to a single search icon button that opens the same overlay.

| Property | Value | Token |
|---|---|---|
| Width | 220px (fixed; icon-only below md) | `--ngpt-comp-search-field-width` |
| Height | 32px | `--ngpt-comp-search-field-height` |
| Padding | 0 10px | `--ngpt-sys-space-250` |
| Radius | 8px | `--ngpt-sys-shape-corner-small` |
| Background | oklch(0.17 0.005 260) | `--ngpt-bg-raised` |
| Border (default) | 1px solid oklch(0.3 0.005 260) | `--ngpt-comp-control-border-default` |
| Border (hover) | 1px solid oklch(0.45 0.005 260) | `--ngpt-comp-pill-border-hover` |
| Focus treatment | Leading icon recolors to `--ngpt-accent`; no box-shadow ring on the control | `--ngpt-accent` |
| Leading icon | lucideSearch, 16px, oklch(0.6 0.01 260) | `--ngpt-sys-icon-size-md` |
| Placeholder | "Search docs", 13px, oklch(0.6 0.01 260) | `--ngpt-text-muted` |
| Trailing hint | ⌘K keyboard chip, right-aligned | see below |
| Gap | 8px | `--ngpt-sys-space-200` |

It is a `<button>`, not an `<input>` — the real input lives in the overlay. This avoids two focusable text fields competing for the same query.

**Open a11y question (see `docs/gaps-ngp-reference.md` § 6):** an icon-only color change is a
weaker focus indicator than the previous box-shadow ring — confirm it still meets WCAG 2.4.7
before implementing.

### API

Attribute-hosted on the consumer's `<button>` (ADR-0005) — the host **is** the trigger button, no
wrapper element ships.

```ts
selector: 'button[ngptSearchField]'

readonly variant = input<SearchFieldVariant>('default'); // 'default' | 'on-band'
```

No outputs. The host is the button, so the consumer binds the native `(click)` — a re-emitted
`open` output would re-declare native capability, which ADR-0005 forbids.

`aria-label="Search docs"` is a fixed static host attribute, not an input: the placeholder copy it
mirrors is fixed in this component's own template, so an input could only make the two diverge.
`type="button"` is applied as a constructor default (set only when the consumer hasn't set one), so
the trigger never submits a surrounding form.

Call form:

```html
<button ngptSearchField (click)="openSearch()"></button>
<button ngptSearchField variant="on-band" (click)="openSearch()"></button>
```

The leading icon, the "Search docs" placeholder, and the ⌘K chip stay inside the component
template — this is a pre-composed widget, not a generic wrapper, so there is nothing to project.

## Keyboard chip (shared atom)

Used for the ⌘K hint and the overlay's footer legend.

| Property | Value | Token |
|---|---|---|
| Font | JetBrains Mono 11px | `--ngpt-sys-typescale-code` |
| Padding | 2px 5px | `--ngpt-sys-space-050` |
| Radius | 4px | `--ngpt-sys-shape-corner-extra-small` |
| Background | oklch(0.24 0.005 260) | `--ngpt-bg-code-chip` |
| Text color | oklch(0.85 0.01 260) | `--ngpt-text-secondary` |

Chip text is `--ngpt-text-secondary`, not muted: on the 0.24 chip fill, muted measures 4.17:1 and misses
AA at 11px.

## Surface 2 — ⌘K overlay

| Property | Value | Token |
|---|---|---|
| Scrim | rgba(9, 10, 17, 0.8), no blur | `--ngpt-sys-scrim` |
| Scrim z-index | 50 | `--ngpt-sys-z-modal-scrim` |
| Panel z-index | 60 | `--ngpt-sys-z-modal` |
| Panel position | centered horizontally, 15vh from top | `—` |
| Panel width | 560px (calc(100vw - 32px) below sm) | `--ngpt-comp-search-panel-width` |
| Panel max-height | 60vh | `--ngpt-comp-search-panel-max-height` |
| Panel background | oklch(0.2 0.005 260) | `--ngpt-bg-elevated` |
| Panel border | 1px solid oklch(0.26 0.005 260) | `--ngpt-border-subtle` |
| Panel radius | 6px | `--ngpt-sys-shape-corner-extra-small-alt` (was `-medium`/12px) |
| Panel shadow | `0 0 0 1px rgba(0,0,0,.1), 0 1px 2px rgba(0,0,0,.2)` — search-local hairline, not the shared elevation token | `--_ngpt-search-shadow-hairline` (component-local, `search-overlay.css`) |

Scrim change is app-wide (`--ngpt-sys-scrim`/`--ngpt-sys-scrim-blur` in `src/styles/tokens/shape.css`
— the blur token was removed entirely). Panel shadow change is search-local only —
`--ngpt-sys-elevation-level2` is untouched for every other consumer. See `docs/decisions.md`.

### Input row

| Property | Value | Token |
|---|---|---|
| Height | 56px | `--ngpt-comp-search-input-height` |
| Padding | 0 16px | `--ngpt-sys-space-400` |
| Layout | Inset "well" — its own margin, radius, background, and shadow, not a flat full-width row | `--ngpt-bg-active` (background), `--ngpt-sys-shape-corner-extra-small` (radius), `--_ngpt-search-shadow-hairline` (shadow) |
| Leading icon | lucideSearch, 16px, oklch(0.55 0.01 260) | `--ngpt-sys-icon-size-md` |
| Input font | Inter 15px | `--ngpt-sys-typescale-body-large` |
| Input text | oklch(1 0 0) | `--ngpt-text-primary` |
| Placeholder | oklch(0.55 0.01 260) | `--ngpt-text-muted` |
| Trailing | Clear-query button (shown only while `query()` is non-empty; bare — no border in any state, fills `--ngpt-bg-accent-solid` with `--ngpt-text-on-accent` icon on hover/focus-visible) + Esc keyboard chip — two separate elements | `—` |

No border or ring on the input itself — the panel is already the focused surface.

### Result list

| Property | Value | Token |
|---|---|---|
| List padding | 8px | `--ngpt-sys-space-200` |
| Group label | 11.9px / 600 / uppercase / 0.05em, accent-colored, line-height 32px, padding 8px 4px 0, margin 0 -4px. Applies identically to both the "Documentation"/result-group label and the "Recent" label. | `--ngpt-accent` |
| Row padding | 10px 12px, bottom overridden to 4px (deliberate divergence from reference's 0, see gaps doc item 21) | `--ngpt-sys-space-250 --ngpt-sys-space-300`, bottom `--ngpt-sys-space-100` |
| Row radius | 4px | `--ngpt-sys-shape-corner-extra-small` (was `-extra-small-alt`/6px) |
| Row background (idle) | Same well surface as the input row, not transparent | `--ngpt-bg-active` |
| Row min-height | 56px, not padding-only — same token as the input row | `--ngpt-comp-search-input-height` |
| Row gap | 0 — flush, per-row hairline shadow reads the boundary instead | `—` |
| Row shadow | Search-local hairline (see Panel shadow above) | `--_ngpt-search-shadow-hairline` |
| Leading icon | 20px — result rows: page → file icon, heading → hash icon; recent rows: history/clock icon | see Iconography.md addition below |
| Hierarchy connector | Heading results only — vertical + horizontal stroke line, no arrowhead, left of the leading icon | `—` (new, see gaps doc) |
| Trailing icon | Result rows: 22px return-arrow, every row regardless of active state. Recent rows: two 22px action buttons (save-search star, remove-from-history X). | see Iconography.md addition below |
| Title | Inter 13.5px, oklch(0.85 0.01 260) | `--ngpt-text-secondary` |
| Path / section line | Inter 12px, oklch(0.55 0.01 260), below title, 2px gap. Result rows only — recent rows show title only. | `--ngpt-text-muted` |
| Query match highlight | oklch(0.62 0.19 52), 600 weight (color only, no background) | `--ngpt-accent` |
| Row active (hover or arrow focus) | Solid accent fill, full row, no left-border accent, text/icons recolor to an AA-checked on-accent value. See `docs/decisions.md` § Active row: solid accent fill. | `--ngpt-bg-accent-solid` / `--ngpt-text-on-accent` |
| Max visible | Capped at 5 results per group — no scroll-to-fit. Implemented in `groupSearchResults()` against `SEARCH_INDEX_MOCK` (a fixture, not real doc content — see decisions.md § Persistence and ranking). | `—` |

Exactly one row is active at all times, defaulting to the first — Enter always has an unambiguous target. Recent-search rows share this same `role="option"` listbox, `aria-activedescendant`, and arrow-key model as query results — not a separate Tab-only affordance (`docs/gaps-ngp-reference.md` item 17).

Leading/trailing row icons and the hierarchy connector are new as of the 2026-08-23 revision —
not yet in `Iconography.md`'s placeholder table. `docs/gaps-ngp-reference.md` § 1 has the exact
reference SVG paths to source lucide equivalents from.

### Empty states

| Condition | Content |
|---|---|
| Query empty | Recent searches if any, otherwise a 40px-padded centered line: "Search the docs" in 13.5px `--ngpt-text-muted` |
| No matches | 40px-padded centered block: a 40px `lucideSearchX` icon, "No results for “{query}”" in 13.5px `--ngpt-text-secondary`, a 12px `--ngpt-text-muted` hint line, plus a "Try searching for:" label and a row of clickable suggestion chips (reused `ngptPillButton`) populated from `SEARCH_SUGGESTIONS_MOCK` |
| Loading | No spinner. Results are local and synchronous; if a network index is added later, hold the previous results rather than flashing empty. |

### Footer legend

36px row, 1px top border `--ngpt-border-subtle`, padding 0 12px, keyboard chips + 11px `--ngpt-text-muted` labels: Enter select · Arrow-down/Arrow-up navigate · Esc close.

Each key renders its **own** 15px SVG glyph inside the shared `<kbd ngptKbd>` chip — four distinct
icons (Enter, Arrow-down, Arrow-up, Escape), not literal `↑↓`/`↵`/`esc` text. Arrow-down and
Arrow-up are two separate icons, not one combined glyph. See
`docs/gaps-ngp-reference.md` § 4 for the reference SVG paths and the `Kbd` component change this
requires.

## Keyboard and ARIA

| Key | Behavior |
|---|---|
| ⌘K / Ctrl+K | Opens from anywhere; focus goes straight to the input |
| Esc | Closes, restores focus and scroll position to the trigger |
| ↑ / ↓ | Moves the active row, wrapping; scrolls it into the visible region |
| Enter | Navigates to the active result and closes |
| Tab | Cycles within the panel only |

Focus is trapped in the panel while open and the page behind it is scroll-locked. The overlay is `role="dialog" aria-modal="true"` with an `aria-label` of "Search docs"; the input is `role="combobox"` with `aria-expanded`, `aria-controls`, and `aria-activedescendant` pointing at the active row. Result count changes are announced through a polite live region.

## HTML/CSS mock

Reference render only. The field's `.search-field` block below is implemented as `:host` /
`:host(:hover)` / `:host(:focus-visible)` on `button[ngptSearchField]` — the class no longer exists.

```html
<!-- as built: <button ngptSearchField> — the inner content below is the component template -->
<button class="search-field" aria-label="Search docs">
  <ng-icon name="lucideSearch" size="16px" />
  <span class="search-field__placeholder">Search docs</span>
  <kbd class="kbd">⌘K</kbd>
</button>

<div class="search-scrim is-open"></div>
<div class="search-panel is-open" role="dialog" aria-modal="true" aria-label="Search docs">
  <div class="search-input-row">
    <ng-icon name="lucideSearch" size="16px" />
    <input role="combobox" aria-expanded="true" placeholder="Search docs" />
    <kbd class="kbd">esc</kbd>
  </div>
  <div class="search-results">
    <div class="search-group-label">Primitives</div>
    <!-- max 5 rows rendered per group, no scroll-to-fit -->
    <a class="search-row is-active">
      <ng-icon name="lucideFile" size="20px" /> <!-- or lucideHash for heading results -->
      <!-- heading results also get a tree-connector svg here, left of the icon -->
      <span class="search-row__title">Table Primitive</span>
      <span class="search-row__path">Primitives › Table › Sorting</span>
      <ng-icon name="lucideCornerDownLeft" size="20px" class="search-row__action" /> <!-- always rendered, every row -->
    </a>
  </div>
  <div class="search-footer">
    <kbd class="kbd"><ng-icon name="lucideCornerDownLeft" size="15px" /></kbd> select
    <kbd class="kbd"><ng-icon name="lucideArrowDown" size="15px" /></kbd><kbd class="kbd"><ng-icon name="lucideArrowUp" size="15px" /></kbd> navigate
    <kbd class="kbd"><ng-icon name="lucideX" size="15px" /></kbd> close <!-- escape glyph, placeholder icon name -->
  </div>
</div>
```

```css
.search-field {
  display: flex;
  align-items: center;
  gap: 8px;
  width: var(--ngpt-comp-search-field-width);
  height: var(--ngpt-comp-search-field-height);
  padding: 0 10px;
  border-radius: var(--ngpt-sys-shape-corner-small);
  border: 1px solid var(--ngpt-comp-control-border-default);
  background: var(--ngpt-bg-raised);
  color: var(--ngpt-text-muted);
  font-size: 13px;
  cursor: pointer;
}
.search-field:hover { border-color: var(--ngpt-comp-pill-border-hover); }
.search-field:focus-visible { outline: none; } /* no box-shadow ring — see Open a11y question above */
.search-field:focus-visible ng-icon { color: var(--ngpt-accent); }
.search-field__placeholder { flex: 1; text-align: left; }

.kbd {
  font: 400 11px "JetBrains Mono", monospace;
  padding: 2px 5px;
  border-radius: var(--ngpt-sys-shape-corner-extra-small);
  background: var(--ngpt-bg-code-chip);
  color: var(--ngpt-text-secondary);
}

.search-scrim {
  position: fixed;
  inset: 0;
  z-index: var(--ngpt-sys-z-modal-scrim, 50);
  background: var(--ngpt-sys-scrim);
  backdrop-filter: blur(2px);
  opacity: 0;
  transition: opacity var(--ngpt-sys-motion-duration-slow) var(--ngpt-sys-motion-easing-decelerate);
}
.search-scrim.is-open { opacity: 1; }

.search-panel {
  position: fixed;
  top: 15vh;
  left: 50%;
  z-index: var(--ngpt-sys-z-modal, 60);
  display: flex;
  flex-direction: column;
  width: var(--ngpt-comp-search-panel-width);
  max-height: var(--ngpt-comp-search-panel-max-height);
  border-radius: var(--ngpt-sys-shape-corner-extra-small-alt); /* 6px */
  border: 1px solid var(--ngpt-border-subtle);
  background: var(--ngpt-bg-elevated);
  box-shadow: var(--ngpt-sys-elevation-level2);
  opacity: 0;
  transform: translate(-50%, -8px);
  transition:
    opacity var(--ngpt-sys-motion-duration-slow) var(--ngpt-sys-motion-easing-decelerate),
    transform var(--ngpt-sys-motion-duration-slow) var(--ngpt-sys-motion-easing-decelerate);
}
.search-panel.is-open { opacity: 1; transform: translate(-50%, 0); }

.search-input-row {
  display: flex;
  align-items: center;
  gap: 10px;
  height: var(--ngpt-comp-search-input-height);
  padding: 0 16px;
  border-bottom: 1px solid var(--ngpt-border-subtle);
  color: var(--ngpt-text-muted);
}
.search-input-row input {
  flex: 1;
  border: none;
  background: none;
  outline: none;
  font: 400 15px Inter, sans-serif;
  color: var(--ngpt-text-primary);
}

.search-results { padding: 8px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
.search-group-label {
  font: 600 11px Inter, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ngpt-text-muted);
  padding: 10px 10px 6px;
}
.search-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--ngpt-sys-shape-corner-extra-small); /* 4px, was 6px */
  text-decoration: none;
}
.search-row__content { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.search-row__title { font-size: 13.5px; color: var(--ngpt-text-secondary); }
.search-row__path { font-size: 12px; color: var(--ngpt-text-muted); }
.search-row mark { background: none; color: var(--ngpt-accent); font-weight: 600; }
.search-row__action { flex-shrink: 0; } /* rendered on every row, not just active */
.search-row.is-active {
  background: var(--ngpt-bg-accent-solid); /* no left border, full-bleed */
}
.search-row.is-active .search-row__title,
.search-row.is-active .search-row__path,
.search-row.is-active .search-row__icon,
.search-row.is-active .search-row__action { color: var(--ngpt-text-on-accent); } /* AA-checked, see decisions.md */

.search-footer {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 12px;
  border-top: 1px solid var(--ngpt-border-subtle);
  font-size: 11px;
  color: var(--ngpt-text-muted);
}

@media (max-width: 1023px) {
  .search-field { width: 32px; }
  .search-field__placeholder, .search-field .kbd { display: none; }
}
@media (max-width: 639px) {
  .search-panel { width: calc(100vw - 32px); top: 8vh; }
}
```
