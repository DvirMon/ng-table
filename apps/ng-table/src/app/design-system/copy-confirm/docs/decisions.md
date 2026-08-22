# copy-confirm — decisions

New domain, created by the ADR-0005 conversion pass. Everything here is a build-time judgment call
not spelled out in the ADR or in `apps/ng-table/docs/CONVENTIONS.md`.

## Selector is `button[ngptCopyConfirm]`, not a bare attribute

ADR-0005 notes the directive "can sit on a `<button ngptPillButton>`, a bare `<button>`, or an
`<a>`". Shipped restricted to `button[…]`:

- CONVENTIONS rule 1 says an attribute selector **names the elements it is valid on**, and rule 4
  says `<button>` for actions, `<a>` for navigation. Copying is an action; a copy `<a>` would be
  the anti-pattern rule 4 exists to prevent.
- All three of the ADR's reusability cases except `<a>` are still covered — it works on
  `<button ngptPillButton>` and on a bare `<button>` unchanged, because it depends on nothing from
  `icon-button` except an element to sit on.

Widening to `a[ngptCopyConfirm]` later is a one-token change if a real need appears.

## The hold timer: `setTimeout` + `getComputedStyle`, **not** the CSS animation

ADR-0005 proposes replacing the `setTimeout` with a CSS animation on the confirm state plus an
`(animationend)` host listener. It was attempted and rejected. Three findings, the first fatal:

**1. A directive has no stylesheet, so the keyframes can only live on the host's component — and
the host is not guaranteed to have one.** The only place the animation could go is
`icon-button.css` (where `:host([data-copy-state='copied'])` does match, since emulated
encapsulation compiles `:host(…)` to `[_nghost-x][data-copy-state='copied']` and matches whoever
wrote the attribute). But the directive is explicitly specified as usable on a bare `<button>` and
on `<button ngptPillButton>`. On either of those there is no such rule, so **no animation starts,
`animationend` never fires, and the button is stuck showing "Copied" forever** — the exact failure
mode the ADR warns about, arrived at by a different route. Fixing it would mean copying the
keyframes into `pill-button.css` and into every future host's stylesheet: the directive's
*correctness* scattered across foreign stylesheets it does not own. That is worse than the
duplication the extraction set out to remove.

**2. `src/styles/global.css` would collapse the hold under reduced motion, not preserve it.** The
global block is

```css
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: var(--ngpt-sys-motion-duration-fast) !important; }
}
```

That is `120ms`, and it is `!important`, so a local rule cannot win without its own `!important`
fight inside `icon-button.css`. It does keep `animationend` firing (the ADR's stated hazard is
`animation: none`, which this app never had), but it turns a 1400ms *reading* dwell into a 120ms
flash — for users who asked for less motion, and disproportionately for the screen-reader users
the confirmation is most for. The hold is not motion; it is time to perceive an outcome. WCAG's
motion guidance is not asking for it to be shortened.

`setTimeout` sidesteps this entirely: the global rule reaches CSS animations, not timers, so the
hold is a constant 1400ms in both motion preferences. That is the intended behavior, and it is
why no reduced-motion branch appears in this domain (CONVENTIONS rule 9 scopes the
component-level obligation to components that *apply transforms* — this one applies none).

**3. `animationend` bubbles.** The consumer authors the button's children, so any future animated
descendant would fire `animationend` on the host and revert the state early. Solvable with an
`event.target === host` guard, but it is one more thing the CSS route costs.

**What shipped.** `--ngpt-comp-icon-btn-confirm-hold` is still the single source of truth — it is
read off the host with `getComputedStyle(...).getPropertyValue()`, parsed by
`parseCssDurationMs()` in `copy-confirm.utils.ts`, and cached per directive instance. Read lazily
at the first settle rather than in the constructor, so stylesheets are guaranteed applied; cached,
because `getComputedStyle` forces a style recalculation and this sits on a click path. **Both
`1400` literals in `code-block.ts` and `install-row.ts` are deleted** — which was the ADR's actual
objective. The apologetic JSDoc on both ("can't read the token without a `getComputedStyle`
round-trip, no precedent for that in this app") is answered: the round-trip is the precedent now,
and it happens once.

**Flagged delta:** `HOLD_UNRESOLVED_MS = 1400` remains as a last-resort guard for environments
where computed styles yield nothing (jsdom without the token file, SSR). This does duplicate the
token's value, which CONVENTIONS' no-fallback rule dislikes. It is not a CSS `var()` fallback —
it can never shadow a present token, because it is only reached when parsing returns `undefined`
— but it can still drift if the token changes. Reporting rather than improvising past it. The
alternative (no fallback, revert immediately when unresolvable) would make the confirmation
invisible in tests, which is a worse failure.

## The live region: a shared body-level node, not `aria-label` alone

A `@Directive` has no template, so it cannot render the visually-hidden
`<span aria-live="polite">` the old `icon-button` component did. Three options were on the table:

| Option | Verdict |
|---|---|
| Host `[attr.aria-label]` alone | **Does not announce.** An accessible-name change is not a live-region trigger. Screen readers announce a name change only when the element is focused *and* the reader happens to re-poll it — and the copy button often is focused, which is exactly what makes this failure easy to mistake for success in manual testing. |
| `aria-live="polite"` on the host `<button>` | **Announces the wrong thing, or nothing.** A live region announces on *content* changes inside it. The button's content is the `<ng-icon>`, which is `aria-hidden`, so the mutation the `@switch` produces computes to an empty string. Adding `aria-label` to the region does not fix it: per ARIA, a region's `aria-label` labels the region, it is not the announced text. It also makes the whole button a live region, so any future content change announces. |
| A body-level polite region the directive writes into | **Shipped.** |

`copy-confirm.announcer.ts` is an `@Injectable({ providedIn: 'root' })` service owning one
`<div role="status" aria-live="polite" aria-atomic="true">` appended to `<body>`, created lazily
on the first announcement and removed on app destroy. Announcing sets `textContent` to `''` and
writes the message on the next task — this is what makes a *repeat* copy announce at all, since
re-assigning an identical string is not a content change. This is the canonical requirement met
properly: the region is in the document before the change, and the change is textual.

It also fixes the limitation the pre-conversion `icon-button/docs/decisions.md` flagged and left
open ("if a caller drives `state` from `'copied'` back to `'copied'` without an intermediate
`'idle'` tick, some screen readers won't re-announce").

**Why not `@angular/cdk`'s `LiveAnnouncer`,** which does exactly this: `@angular/cdk` is not a
declared dependency of this repo (it is present only transitively). `search-overlay` already
hand-rolls its focus trap for the same reason and records it in its own `docs/decisions.md`;
following that precedent rather than adding an undeclared dependency.

**Two deltas this creates, both flagged rather than hidden:**

- **DOM insertion by a directive.** The attribute-hosted invariant `libs/shared/table` states is
  "attribute-only, never insert or reorder DOM". The announcer node goes into `document.body`, not
  into the consumer's subtree, so no consumer markup is inserted, reordered, or reflowed — but it
  is still a node this directive creates, and worth knowing about.
- **Inline styles on that node.** CONVENTIONS rule 3 forbids inline styles. The visually-hidden
  recipe is applied via `element.style` because the node is created outside any component's view,
  so no encapsulated stylesheet reaches it, and this app has no global visually-hidden utility
  class. Adding one to `src/styles/global.css` would be the cleaner fix but is outside this
  domain's write scope — recommend it for a follow-up.

## `failedLabel` as an input — the live bug this closes

Pre-conversion, `install-row` computed its own spec'd failure copy ("Copy failed — select the
command manually") and passed it nowhere `icon-button` would read: `icon-button`'s
`confirmationMessage()` hardcoded `'Copy failed, select manually'` and `accessibleLabel()`
preferred it over `label()`. The spec'd copy was silently discarded on every failure. With
`idleLabel`/`copiedLabel`/`failedLabel` as inputs there is exactly one place the label comes from,
and the consumer's value wins because there is nothing left to override it.

Defaults are the strings `icon-button` used to hardcode, so a consumer that sets nothing keeps
today's behavior.

## `text` is optional, not `input.required`

`code-block` passes `code()` and `install-row` passes `command()`, both `input<string>()` and so
both `string | undefined`. A required input would not type-check at either call site. Unset or
empty makes `copy()` a no-op, matching `install-row`'s existing guard.

## No `execCommand` fallback

`icon-button/docs/spec.md` § "Confirmation variant" describes a hidden-textarea +
`document.execCommand('copy')` fallback wired to both the rejection handler and the no-API branch.
Neither `code-block` nor `install-row` ever implemented it — both went straight to `failed` — so
porting it would be new behavior, not extraction, and it would mean inserting a `<textarea>` into
the document from a directive (see the DOM-insertion note above). `document.execCommand` is also
deprecated. Kept the shipped behavior, flagging the gap: **the spec still describes a fallback
that does not exist.** A deliberate decision to add or to strike it belongs in a separate pass.

## No `copied`/`failed` outputs

Not requested and not needed by either call site: `state` is already a public readonly signal, and
a consumer wanting to react can `effect()` on it. Adding outputs that duplicate an exposed signal
is API surface with no caller.

## Icons

Not applicable. This directive renders nothing, so it registers no icons — the consumer authors
the glyphs and registers them (ADR-0004). The mapping the pre-conversion `icon-button` used is
unchanged and now lives at each call site: `✓` → `lucideCheck`, `⚠` → `lucideTriangleAlert`,
`⧉` → `lucideCopy`, per `src/styles/docs/Iconography.md`.

## Verification status

Not built, linted, or tested — the task forbids running `nx build`/`lint`/`test` and the standing
repo rule forbids doing so unprompted. A typecheck would fail regardless until the separate
call-site pass lands, because `code-block.ts` and `install-row.ts` still import the deleted
`IconButtonState` and bind the deleted `icon`/`state`/`(pressed)`.
