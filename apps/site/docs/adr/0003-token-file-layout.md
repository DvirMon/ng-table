# ADR-0003: One token file per foundations spec

## Status

Accepted — 2026-08-22

## Context

The design handoff's `specs/foundations/` has 8 files (Color, Typography, Spacing, Layout and Sizing,
Radius and Elevation, Motion, Iconography, Responsive and Breakpoints), each ending in a copy-pasteable
`:root` block. `Focus and Keyboard.md` is the ninth foundations spec but defines no tokens of its own
(`--ngpt-focus-ring` and `--ngpt-sys-layout-scroll-offset` are both defined in `Color.md` / `Layout and
Sizing.md`; Focus and Keyboard only consumes them).

## Decision

`src/styles/tokens/` has 8 CSS files, one per foundations spec, each containing **only** that spec's
`:root` block, pasted verbatim. `tokens.css` imports all 8. The specs themselves are colocated at
`src/styles/docs/` (moved out of the handoff bundle during Wave 0 spec distribution).

Two specs' code fences carried more than tokens — `Motion.md`'s fence also had illustrative
transition-baseline CSS tied to example class names (`.nav-item`, `.pill-button`, …) that don't match
this build's actual selectors, and `Responsive and Breakpoints.md`'s fence had the docs-shell page grid
and sidebar-drawer CSS, which is out of scope this round (no sidebar/TOC/3-col shell built). Both were
trimmed to their `:root` block only; the generic parts of Motion's reduced-motion behavior (scroll-behavior
toggle, transition-duration collapse) were reimplemented in `src/styles/global.css` without the stale
class-name coupling.

## Rationale

1:1 file-to-spec mapping makes token drift auditable — a maintainer can diff a token file against its
spec's trailing block. Keeping illustrative/example CSS out of the token layer keeps that diff meaningful.

## Consequences

Component-specific reduced-motion behavior (e.g. `dropdown-menu` and the search overlay suppressing
`transform` under `prefers-reduced-motion`) is each component's own responsibility, not global.css's —
noted in `docs/CONVENTIONS.md`.
