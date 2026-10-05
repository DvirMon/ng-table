# code-block — decisions

## Shiki deferral (explicit, per build instructions)

No Shiki this round. `<pre><code>` renders plain text, split into one `.line` span per line so the
CSS counter gutter and `.line` block model already match the spec's HTML/CSS mock and Shiki's own
output shape. `CodeBlock.lines` (`code-block.ts`) is the one seam a future Shiki integration
replaces: swap the `(code() ?? '').split('\n')` computed for Shiki's rendered `.line` markup and the
rest of the component (gutter, copy button, host/pre structure) is unchanged. A code comment marks
this spot. Per the spec's ownership table, Shiki would also own token colors and would need its
theme background forced `transparent` so `--ngpt-bg-deep` keeps owning the panel surface — noted
here since no highlighter is wired up yet to actually set it.

Line-highlighting (`states: - "highlighted line"` in the spec front-matter) is in the same bucket:
the CSS rule (`.line.is-highlighted`) is present per the HTML/CSS mock, but nothing sets the class —
its trigger is Shiki fence meta (` ```ts {2,4-6} `), which isn't wired up this round either, and
`highlightedLines` isn't in the fixed contract's inputs. Inert until both land.

## Copy button: built here, diverging from `spec.md`'s ownership note

This is the one call worth flagging loudly. `spec.md`'s ownership table says:

> Copy affordance | **Not here** — lives in the Preview Window toolbar as an Icon Button. A code
> block outside a Preview Window therefore has no copy button; that is deliberate, not an omission.

But `apps/site/docs/CONVENTIONS.md`'s **Fixed component contracts** table — the reconciled,
decided-now contract downstream/parallel agents build against — says code-block "consumes
icon-button... copy button reuses icon-button's confirmation states," and the build instructions for
this task were explicit and detailed about wiring the copy button here (drive `state` from a local
clipboard-write result, listen to `pressed`).

Treated CONVENTIONS.md's fixed contract as authoritative over the older `spec.md` ownership note:
`spec.md` is frozen content "distributed here from the design handoff bundle during Wave 0" and
CONVENTIONS.md is the later reconciliation across components ("decided now so downstream agents
can code against them without waiting on the upstream component's actual implementation"). Built
the copy button into `ngpt-code-block` per CONVENTIONS + the task brief. Flagging in case Preview
Window's own toolbar copy button (also planned, per its own fixed contract) turns out to duplicate
this one — that reconciliation is Preview Window's task, not this one's.

## Gutter stays a pure boolean, no line-count heuristic

Spec text describes the gutter as opting in "at 5+ lines," but the fixed contract pins
`showGutter: input<boolean>(true)` — a plain boolean, not a computed threshold. Kept it that way:
the component renders whatever the caller passes, the "5+ lines" judgment call belongs to whichever
page renders the fence (e.g. a future Doc Article renderer), not to code-block itself.

## Copy button placement: inset to the padding edge, size 24

No token exists for a floating-button inset, so the button is positioned using the same padding
tokens already justified by the Build spec table (`--ngpt-sys-space-400` / `--ngpt-sys-space-450`)
rather than introducing an unbacked pixel value — `.copy-button { top: var(--ngpt-sys-space-400);
right: var(--ngpt-sys-space-450); }` sits it flush with the text's own inset. Sized `24` (the
smallest of icon-button's `24|30|32`) since it's an overlay chip on a dense text block, not a
standalone toolbar control — the fixed contract doesn't pin a size for this consumer, so this is a
visual judgment call.

## `--ngpt-comp-icon-btn-confirm-hold` duplicated as a TS literal

`setTimeout`'s duration is a plain number — it can't read a CSS custom property without a runtime
`getComputedStyle` call, and no other component in this app does that for a timing value. Kept
`COPY_CONFIRMATION_HOLD_MS = 1400` in `code-block.ts` as a literal, commented as mirroring
`--ngpt-comp-icon-btn-confirm-hold` in `src/styles/tokens/sizing.css`, and flagged here per
CONVENTIONS.md rule 10 ("any delta from the fixed contract... you couldn't avoid"). If a future
component needs the same bridge more than once, it's worth extracting a shared
`readMsToken(el, name)` helper instead of duplicating the literal again.

## Margin lives on `:host`, not `.code-block`

The spec's CSS mock puts `margin: 0 0 28px` directly on `.code-block` because there the mock
targets a bare `<pre>`. Here `.code-block` is an inner element of `ngpt-code-block`'s host (needed
so the copy button can sit inside the host as an absolutely-positioned sibling) — the `28px`
(`--ngpt-sys-space-700`) bottom margin was moved to `:host` instead so the component still claims
the right amount of block-level space from the outside, and `.code-block` itself is zeroed to avoid
stacking with a UA-stylesheet `<pre>` margin.

## `code { display: block }` applies unconditionally, not just when numbered

The spec's CSS mock only sets `display: block` on `code` under `.code-block--numbered` (bundled
with `counter-reset: line`). Applied it unconditionally instead (`.code-block code { display:
block; }`, separate from the `.code-block--numbered` rule) — `<code>` is a phrasing/inline element
by default, and its children (`.line` spans) are block-level regardless of the gutter state, so it
needs the block-level box in both states, not only the numbered one.

## No `code-block.types.ts`

Nothing local to type: `copyState` reuses `IconButtonState` from `icon-button.types.ts`, and
`code`/`language`/`showGutter` are all primitives per the fixed contract. Nothing to split out.

## Icon mapping

`lucideCopy` for the idle glyph, per `src/styles/docs/Iconography.md`'s `⧉ → lucideCopy` mapping —
already registered by `icon-button`'s own `viewProviders`, so `code-block.ts` doesn't register any
icons itself; it only ever passes an icon _name_ string to `ngpt-icon-button`. `copied`/`failed`
glyphs (`lucideCheck` / `lucideTriangleAlert`) are icon-button's own concern, not code-block's.

## Two seams added for `preview-window`: `showCopyButton`, `radius`

`preview-window`'s own build left two gaps open against this component (`preview-window/docs/decisions.md`
§§ "duplicate copy button" / "Source panel's 12px radius") because `::ng-deep` is banned and its
task couldn't reach into `code-block`'s encapsulated view or template. Added two inputs here to
close them from the outside instead of by reaching in:

- `showCopyButton: input<boolean>(true)` — a host that renders its own copy affordance (Preview
  Window's toolbar) passes `false` to suppress this component's button rather than showing two.
- `radius: input<'standalone' | 'panel'>('standalone')` — `'panel'` swaps the spec's own 10px
  (`--ngpt-sys-shape-corner-small-alt`) for `--ngpt-sys-shape-corner-medium` (12px), for a host
  that embeds this inside an already-12px-radius surface (Preview Window's Source tab, matching
  its canvas).

Both default to the spec's own standalone look, so every other `ngpt-code-block` usage is
unaffected. `.code-block--panel-radius` is a plain modifier class alongside `.code-block--numbered`,
not a `::ng-deep` reach — `preview-window` sets the input, this component owns the class.

## No other deviations from the fixed contract

`ngpt-code-block`; `code: input<string>()`, `language: input<string>()`,
`showGutter: input<boolean>(true)` — matches the fixed contract exactly. No inputs added or
dropped beyond the two seams above.
