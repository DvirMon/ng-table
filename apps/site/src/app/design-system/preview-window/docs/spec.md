---
id: preview-window
kind: component
atomic: Organism
spec: specs/Preview Window.md
frame: components/Preview Window.dc.html
owns:
  - "The framed live-example surface: border, radius, padding, min-height"
  - "Toolbar row + the Preview/Source tab pair"
  - "Source-panel reveal + copy confirmation"
does_not_own:
  - "The tab control internals — see Tab Switcher.md"
  - "The code inside Source — see Code Block.md"
depends_on:
  - "Tab Switcher.md (tab-switcher)"
  - "Code Block.md (code-block)"
  - "Icon Button.md (icon-button)"
  - "foundations/Radius and Elevation.md (shape)"
  - "foundations/Color.md (color)"
  - "foundations/Spacing.md (spacing)"
states:
  - "Preview tab active"
  - "Source tab active"
  - "copy pending"
  - "copy confirmed"
a11y:
  - "Tab pair follows role=\"tablist\"; the Source panel is a labelled tabpanel"
tokens: [--ngpt-sys-space-250, --ngpt-sys-space-200, --ngpt-sys-space-1000, --ngpt-sys-space-800, --ngpt-sys-shape-corner-medium, --ngpt-bg-surface, --ngpt-border-subtle, --ngpt-accent]
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

> Distributed here from the design handoff bundle (`apps/ng-table/docs/design-handoff/`) during Wave 0 spec distribution — spec wins over the reference frame there.

# Preview Window

**Atomic level:** Organism

Live-example container used throughout the docs. Composed of Tab Switcher + Dropdown Pill (molecules) + Icon Button ×2 (atoms) + a canvas surface.

## Composition

- Toolbar row: Tab Switcher (left) + Dropdown Pill & 2 Icon Buttons (right)
- Canvas surface below, centers the live example content

## Build spec

| Property | Value | Token |
|---|---|---|
| Toolbar layout | flex, space-between | `—` |
| Toolbar margin-bottom | 10px | `--ngpt-sys-space-250` |
| Toolbar right-side gap | 8px | `--ngpt-sys-space-200` |
| Canvas padding | 40px 32px | `--ngpt-sys-space-1000 --ngpt-sys-space-800` |
| Canvas radius | 12px | `--ngpt-sys-shape-corner-medium` |
| Canvas background | oklch(0.13 0.004 260) | `--ngpt-bg-surface` |
| Canvas border | 1px solid oklch(0.26 0.005 260) | `--ngpt-border-subtle` |
| Canvas content alignment | flex, justify-content:center | `—` |
| Width | fills content column (max 760px) | `—` |

## Tab states: Preview vs Source

The Tab Switcher swaps the canvas for a code view. The toolbar row is identical in both states — only the region below it changes.

| Tab | Region below toolbar |
|---|---|
| Preview | Canvas surface (spec above) with the live example centered |
| Source | Code Block (`specs/Code Block.md`) filling the same footprint, Shiki-highlighted with line numbers |

| Property | Value | Token |
|---|---|---|
| Source panel radius | 12px — matches the canvas, **not** the 10px of a standalone code block | `--ngpt-sys-shape-corner-medium` |
| Source panel margin-bottom | 0 — the outer window owns the spacing | `—` |
| Height behavior | Natural height; no min-height match to the Preview tab | `—` |
| Switch transition | opacity, fast / standard; no height animation | see `foundations/Motion.md` |

The panel does not animate height between tabs — the two views are rarely the same size, and a 200px height tween on every tab click is worse than an instant jump. Only opacity crossfades.

ARIA: the two tabs are `role="tab"` in a `role="tablist"`, the region below is `role="tabpanel"` with `aria-labelledby` pointing at the active tab. Arrow keys move between tabs.

## Toolbar interactive states

| Control | Closed / rest | Activated |
|---|---|---|
| "Example CSS" dropdown pill | Per `specs/Dropdown Pill.md` | Opens a Dropdown Menu below it (`specs/Dropdown Menu.md`); the pill holds its hover treatment and its chevron rotates 180° over `fast` while open |
| Copy icon button | lucideCopy, muted | Per `Icon Button.md` § Confirmation variant: glyph swaps to lucideCheck in `--ngpt-status-success`, holds `--ngpt-comp-icon-btn-confirm-hold`, reverts; `--ngpt-status-error` on failure. No toast, no tooltip. |
| Run icon button | lucideZap, muted | Standard hover/focus only |

Copy confirmation is in-place rather than a toast: the button is already where the user is looking, and a toast would need its own overlay layer for one word of feedback. The confirmation is announced through a polite live region for screen readers.

## Notes

Repeats once per live example (one per feature section in the docs page).

## HTML/CSS mock

```html
<div class="preview-window">
  <div class="preview-toolbar">
    <div class="tab-switcher">…</div>
    <div class="toolbar-actions">
      <button class="dropdown-pill">Example CSS ▾</button>
      <button class="icon-button">⧉</button>
      <button class="icon-button">⚡</button>
    </div>
  </div>
  <!-- Preview tab -->
  <div class="preview-canvas" role="tabpanel">
    <!-- live example content -->
  </div>
  <!-- Source tab -->
  <pre class="code-block preview-source shiki" role="tabpanel"><code>…</code></pre>
</div>
```

```css
:root {
  --ngpt-bg-surface: oklch(0.13 0.004 260);
  --ngpt-border-subtle: oklch(0.26 0.005 260);
}

.preview-window { width: 100%; }
.preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.toolbar-actions { display: flex; align-items: center; gap: 8px; }
.preview-source {
  border-radius: var(--ngpt-sys-shape-corner-medium);
  margin: 0;
}
.preview-canvas {
  display: flex;
  justify-content: center;
  padding: 40px 32px;
  border-radius: 12px;
  background: var(--ngpt-bg-surface);
  border: 1px solid var(--ngpt-border-subtle);
}
```
