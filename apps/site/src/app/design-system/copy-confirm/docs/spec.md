---
id: copy-confirm
kind: directive
atomic: Behavior
selector: 'button[ngptCopyConfirm]'
exportAs: ngptCopyConfirm
spec: extracted from design-system/icon-button/docs/spec.md § "Confirmation variant (copy)"
adr: ../../../../docs/adr/0005-attribute-hosted-components.md
owns:
  - 'The clipboard write and its success/failure outcome'
  - 'The idle → copied/failed → idle hold, and restart-on-re-click'
  - 'Per-state accessible name (aria-label + title) on the host button'
  - 'The polite live-region announcement of the outcome'
  - 'The data-copy-state host attribute other stylesheets key off'
does_not_own:
  - 'Any styling — a @Directive carries no stylesheet'
  - 'The glyph — the consumer authors it and branches on state()'
  - 'The confirmed/failed color — icon-button.css, keyed off data-copy-state'
depends_on:
  - 'src/styles/tokens/sizing.css (--ngpt-comp-icon-btn-confirm-hold)'
states:
  - 'idle'
  - 'copied'
  - 'failed'
a11y:
  - 'Accessible name changes with state via aria-label on the host.'
  - 'Outcome announced through a shared body-level aria-live="polite" region.'
tokens: [--ngpt-comp-icon-btn-confirm-hold]
token_values_resolve_in: src/styles/tokens/ (single source of truth — never restate values here)
---

# Copy Confirm

**Atomic level:** Behavior (directive, no template, no styles)

Extracted under [ADR-0005](../../../../docs/adr/0005-attribute-hosted-components.md) § "Corollary:
opt-in behavior is a consumer-placed directive, never `hostDirectives`". Before extraction this
machine was duplicated verbatim in `code-block` and `install-row` (two `1400` literals, two
`revertTimer` fields, two `clearRevertTimeout()` methods) while `icon-button` carried a `state`
input and a live region every non-copying icon button paid for and never used.

## Placement

The consumer puts it **beside** a component on the same `<button>`. Legal because Angular forbids
only _component + component_ on one host; a component plus any number of directives composes
freely. It is not `hostDirectives` on `icon-button` — that is statically resolved, so it would
apply to every icon button in the app, defeat tree-shaking, and force `icon-button` to re-declare
`text`/`idleLabel`/`failedLabel` in its own metadata.

```html
<button
  ngptIconButton
  ngptCopyConfirm
  #copy="ngptCopyConfirm"
  [text]="command()"
  idleLabel="Copy install command"
  failedLabel="Copy failed — select the command manually"
>
  @switch (copy.state()) { @case ('copied') {
  <ng-icon
    name="lucideCheck"
    size="var(--ngpt-sys-icon-size-sm)"
    color="currentColor"
    aria-hidden="true"
  />
  } @case ('failed') {
  <ng-icon
    name="lucideTriangleAlert"
    size="var(--ngpt-sys-icon-size-sm)"
    color="currentColor"
    aria-hidden="true"
  />
  } @default {
  <ng-icon
    name="lucideCopy"
    size="var(--ngpt-sys-icon-size-sm)"
    color="currentColor"
    aria-hidden="true"
  />
  } }
</button>
```

The consumer registers `lucideCopy` / `lucideCheck` / `lucideTriangleAlert` locally
(`viewProviders: [provideIcons({ … })]`, ADR-0004) and imports `NgIcon`, `IconButton`,
`CopyConfirm` directly — no barrels (ADR-0002).

## API

| Input         | Type                  | Default                          | Notes                                                 |
| ------------- | --------------------- | -------------------------------- | ----------------------------------------------------- |
| `text`        | `string \| undefined` | `undefined`                      | What to write. Unset or `''` makes the click a no-op. |
| `idleLabel`   | `string`              | `'Copy'`                         |                                                       |
| `copiedLabel` | `string`              | `'Copied'`                       |                                                       |
| `failedLabel` | `string`              | `'Copy failed, select manually'` |                                                       |

| Member   | Type                       | Notes                                                               |
| -------- | -------------------------- | ------------------------------------------------------------------- |
| `state`  | `Signal<CopyConfirmState>` | Readonly. `'idle' \| 'copied' \| 'failed'`.                         |
| `label`  | `Signal<string>`           | Readonly, derived. The label for the current state.                 |
| `copy()` | `void`                     | Bound to the host `click`; public so a consumer can trigger it too. |

No outputs. Host bindings: `[attr.data-copy-state]`, `[attr.aria-label]`, `[attr.title]`,
`(click)`.

`exportAs: 'ngptCopyConfirm'` — required, since the whole point is that the consumer's template
reads `state()` to pick the glyph.

## Behavior

1. `click` → `navigator.clipboard.writeText(text())`.
2. Resolve → `copied`. Reject, or `navigator.clipboard` absent → `failed`. Both land in one
   `catch`: a missing `clipboard` throws synchronously inside the same `try`.
3. `aria-label` and `title` switch to the state's label; the label is announced politely.
4. After `--ngpt-comp-icon-btn-confirm-hold`, back to `idle`.

Re-clicking during the hold **restarts** the hold rather than queueing a second one, and
re-announces — the announcer clears its region before writing, so an identical repeat message is
still a content change.

The failure state is not theoretical: an unfocused document, a permissions policy, a non-secure
context, or an iframe without `clipboard-write` all produce a rejected promise rather than a
missing API. A button that appears inert on click is worse than one that reports failure, so
`failedLabel` tells the reader to select the text manually.

**Not implemented:** the `document.execCommand` hidden-textarea fallback the icon-button spec
describes. See `docs/decisions.md`.

## Hold duration

`--ngpt-comp-icon-btn-confirm-hold` is the single source. It is read off the host once via
`getComputedStyle`, lazily at the first settle, and cached. The CSS-animation +
`(animationend)` approach ADR-0005 proposes was attempted and rejected — see `docs/decisions.md`
for why, and for why reduced motion must not shorten this particular duration.
