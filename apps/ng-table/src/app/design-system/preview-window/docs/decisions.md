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

## The duplicate copy button (`CONTEXT.md` § Deliberate gaps) is not resolved here

The gap note says settle it "when `preview-window` is built." It can't be, within this build's
constraints: `code-block`'s own copy button is baked into its template unconditionally (fixed
contract: "no Shiki this round" is the only stated flex point; the copy button isn't gated by an
input), and `docs/CONVENTIONS.md` forbids reaching into a child component's encapsulated view
(`::ng-deep` is banned) or editing another domain's component from this task. So the Source tab
still shows two copy affordances: `code-block`'s own top-right button and this toolbar's. Fixing
it needs a `code-block` change (e.g. a `showCopyButton` input) that is out of this task's scope —
flagged for whoever next touches `code-block`, not fixed by improvising past the contract here.

## Source panel's 12px radius vs. code-block's own 10px

Spec: "Source panel radius 12px — matches the canvas, not the 10px of a standalone code block."
Same encapsulation constraint as above — `code-block`'s `.code-block` radius is internal to its
own stylesheet and unreachable from here without `::ng-deep`. Shipped with `code-block`'s own
10px rather than fight it; noted as a spec delta, not silently "fixed" with a banned tool.

## Icon glyphs

`lucideCopy` / `lucideCheck` / `lucideTriangleAlert` for the copy button's idle/copied/failed
states — same three icons `code-block` and `install-row` already use for the identical
`ngptCopyConfirm` states, per `foundations/Iconography.md`'s mapping table.
