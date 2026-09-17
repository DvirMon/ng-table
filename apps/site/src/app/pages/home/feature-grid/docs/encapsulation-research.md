# Styling projected content: is `ViewEncapsulation.None` justified?

Research for CONVENTIONS.md rule #8 (`ngptProse`, `ngptHomeFeatureGrid`). Angular 20-22, standalone,
zoneless, plain CSS.

## Verdict

**Yes, `ViewEncapsulation.None` scoped under a host class is the correct call for this app, and no
alternative below is strictly better under the stated constraints (no `::ng-deep`, no SCSS, OnPush/
zoneless, plain CSS).** The two native CSS mechanisms that exist specifically for this problem
(`::slotted()`, `::part()`) both require real Shadow DOM, which this app cannot adopt for a design
system without accepting bigger costs (native slot semantics, `:host-context` differences, harder
global-token inheritance, worse devtools ergonomics) than the leak risk `None` carries. The
"leak" concern is real — confirmed below — but rule 8's mitigation (every selector scoped under the
component's own host class) already contains it to the same blast radius Shadow DOM would give you,
without the Shadow DOM downsides. Keep `None` for this narrow case; don't reach for it on components
that only style their own template.

## Alternatives considered

| Approach | Verdict | Why |
|---|---|---|
| **CSS Shadow Parts** (`::part()` / `exportparts`) | Not viable | `::part()` only matches when the originating element is a **shadow host** — it's meaningless under emulated encapsulation, which has no shadow root. It would also require the *consumer* to author `part="..."` on every projected element, which contradicts "consumer authors arbitrary markup" (feature-grid's whole point) and isn't enforceable from the projecting component. |
| **`ViewEncapsulation.ShadowDom`** | Viable but bigger tradeoff | Real Shadow DOM does make native `::slotted()` work, and containment becomes structural (browser-enforced) instead of convention-enforced (a host class you must remember to scope under). But it's a bigger change than swapping an enum value: global `--ngpt-*` custom properties still pierce (fine, that's desired), but global resets/typography from `src/styles/global.css` that rely on normal cascade (non-custom-property rules) stop reaching in; `:host-context()` behaves differently; third-party libraries this app already depends on for floating UI/menus (`ng-primitives`) may assume light DOM for portal/overlay attachment; and only 2 of 16+ DS components need this at all. Adopting it for two components to get a cleaner selector story isn't worth the surface-wide risk of a rendering-model change. Confirmed not deprecated — it's a first-class encapsulation mode in current Angular (alongside the newer `ExperimentalIsolatedShadowDom`, which is even stricter and even further from this app's needs).
| **Native `::slotted()`** | Not viable under emulated encapsulation | Requires a real shadow tree — same shadow-host requirement as `::part()`. Angular issue [angular/angular#11595](https://github.com/angular/angular/issues/11595) (add `::slotted()` support to Emulated/Native encapsulation) is **closed, Backlog milestone, unaddressed for years** — this is not a "not shipped yet," it's parked. Confirms `::ng-deep`/`None` are the only two paths under Emulated, and `::ng-deep` is banned in this repo. |
| **Renderer2 / `contentChildren` + imperative host bindings** | Viable but bigger tradeoff | Sidesteps encapsulation entirely by reaching for DOM references instead of CSS selectors — works regardless of encapsulation mode. But it moves styling out of CSS into TS: no cascade, no media queries without manual `matchMedia` listeners, no `:hover`/`:focus-within` for free, and it breaks the "state as `data-*` attributes, CSS reacts" pattern this repo standardizes on (CONVENTIONS.md #3). For feature-grid's actual need — grid track formula + heading/paragraph typography on cells whose count and shape isn't fixed — this would mean walking `contentChildren(ElementRef)` and manually toggling classes per child, redone on every content change, for something eleven lines of scoped CSS already does declaratively. Reserve this pattern for cases where you need to react to *which* element got projected (conditional behavior), not for pure styling. |
| **Wrapping/re-rendering projected content via structural directive or `ngTemplateOutlet`/`createEmbeddedView` so it inherits the parent's id** | Not viable — doesn't do what it sounds like | The `_nghost-*`/`_ngcontent-*` attribute stamp is baked in at **compile time**, per the template file where markup is lexically authored — not at the call site that renders it at runtime. Content written inside a consumer's `<ng-template>` and later rendered via `ViewContainerRef.createEmbeddedView()` still carries the consumer's compiled stamp; moving *where* a `TemplateRef` gets instantiated doesn't re-stamp its nodes. There is no supported way to make Angular re-attribute nodes to a different component's id at runtime. This path only appears to work if you additionally add `ViewEncapsulation.None` to strip the attribute-selector dependency entirely — at which point you've just done rule 8 with extra indirection. |
| **Confirm: does `None` really leak the *whole* stylesheet, not just projected-content rules?** | Confirmed — the leak risk is real | Per [angular.dev/guide/components/styling](https://angular.dev/guide/components/styling): `ViewEncapsulation.None` "disables all encapsulation entirely — styles behave as global styles." It is not selective; every rule in that `.css` file, including ones that only ever need to match the component's own template, becomes globally scoped the instant the enum flips. Rule 8's per-file discipline (host-class-scope *every* selector) is the only thing standing between this and real leakage — it is a hand-enforced invariant, not a compiler-enforced one, so it is worth a lint/review checklist item, not just prose in CONVENTIONS.md. |

## Recommendation

No change to rule 8's core call for `ngptProse` / `ngptHomeFeatureGrid`. Two refinements worth adding
to CONVENTIONS.md going forward, in this codebase's own style (plain CSS, host-class scoping):

1. **Make the host-class-scoping discipline lint-checkable, not just documented.** Since `None`
   removes the compiler's safety net, a stylelint rule requiring every top-level selector in a
   `ViewEncapsulation.None` component's `.css` file to start with `.ngpt-<component>` would catch the
   one mistake this pattern is exposed to (an unscoped rule slipping in during a later edit).
   Something like:
   ```css
   /* feature-grid.css — every rule scoped, per rule 8 */
   .ngpt-home-feature-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
   .ngpt-home-feature-grid > article h3 { /* ok: still under the host class */ }
   h3 { /* would leak globally — this is the mistake to lint for */ }
   ```
2. **Reserve `ViewEncapsulation.None` for exactly this shape of problem** (a component's *entire
   purpose* is styling arbitrary consumer-authored markup it doesn't own) **and use `contentChildren`
   + host bindings instead when the need is narrower** — e.g. "add a class to the first/last projected
   child" or "react to which element got projected" — since that's a one-time imperative touch, not a
   standing stylesheet, and doesn't carry the global-scope risk at all.

No component currently on the table needs `ShadowDom`; keep it in mind only if a future DS component
needs deep style isolation from a page that embeds it in a context this app doesn't control (e.g. a
widget embedded in a third-party host page) — that is the actual use case Shadow DOM answers, not
"style my projected content."
