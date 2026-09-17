# preview-window — decisions

## Scope narrowed to the fixed contract, not the full spec

`docs/spec.md`'s toolbar has three right-side controls: an "Example CSS" dropdown-pill, a Copy
icon-button, and a Run icon-button. `docs/CONVENTIONS.md`'s fixed contract row for this component
only lists `tab-switcher + code-block + icon-button` and calls it "leaf this round, no render
surface yet" — no consumer exists to pick a CSS example or run anything. Built to the contract:
Tab Switcher (Preview/Source) left, one Copy icon-button right. The dropdown-pill and Run button
are not built; add them when a real consumer needs example switching or execution.

## Fixed two tabs, not an `input()`

`tabs` is a hardcoded `PREVIEW_WINDOW_TABS` constant (`preview`/`source`), not exposed as an
input — the spec fixes exactly this pair ("Tab states: Preview vs Source"), so there is nothing
for a consumer to configure.

## Canvas content is projected, not typed

No `PreviewWindowExample`-style input — the Preview tab's canvas is `<ng-content />`. The "no
render surface yet" note means there is no real live-example content this round; projection keeps
the component correct for whenever one exists, same reasoning `code-block`'s `.line` split
documents for its own deferred Shiki integration.

## The duplicate copy button (`CONTEXT.md` § Deliberate gaps) — resolved

`code-block` now exposes `showCopyButton: input<boolean>(true)`. The Source tab's `ngpt-code-block`
is called with `[showCopyButton]="false"`, so only this toolbar's Copy button renders — it already
covers both tabs (its `[text]` is the same `code()`), so it, not `code-block`'s own button, is the
one that survives. See `code-block/docs/decisions.md` for the seam itself.

## Source panel's 12px radius vs. code-block's own 10px — resolved

Spec: "Source panel radius 12px — matches the canvas, not the 10px of a standalone code block."
`code-block` now exposes `radius: input<'standalone' | 'panel'>('standalone')`; the Source tab's
`ngpt-code-block` is called with `radius="panel"`, which applies `--ngpt-sys-shape-corner-medium`
(12px) instead of its own default 10px. See `code-block/docs/decisions.md` for the seam itself.

## Icon glyphs

`lucideCopy` / `lucideCheck` / `lucideTriangleAlert` for the copy button's idle/copied/failed
states — same three icons `code-block` and `install-row` already use for the identical
`ngptCopyConfirm` states, per `foundations/Iconography.md`'s mapping table.
