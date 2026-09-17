---
id: page-footer
kind: layout
atomic: Molecule
spec: specs/layout/Page Footer.md
frame: components/Page Footer.dc.html
owns:
  - "Full-width footer below the grid: top divider, padding, muted text"
does_not_own:
  - "Prev/next page cards — that is Pagination Footer.md, which lives inside the content column"
depends_on:
  - "foundations/Color.md (color)"
  - "foundations/Typography.md (typography)"
states:
  - "default"
a11y:
  - "contentinfo landmark — implicit on the native <footer> host; no explicit role= (see decisions.md). Requires the footer not be nested in <article>/<aside>/<main>/<nav>/<section>."
tokens: [--ngpt-sys-space-700, --ngpt-comp-row-divider, --ngpt-sys-typescale-label-large-sm, --ngpt-text-tertiary]
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

> Distributed here from the design handoff bundle (`apps/site/docs/design-handoff/`) during Wave 0 spec distribution — spec wins over the reference frame there.

# Layout — Page Footer

Full-width strip below the page grid (outside the 3-column layout, spans the whole viewport width).


## API

Attribute-hosted (ADR-0005) — the consumer authors the footer's contents, the primitives style
them. No `links` input; nothing here inserts, removes or reorders DOM.

| Primitive | Selector | Inputs | Content |
|---|---|---|---|
| strip | `footer[ngptPageFooter]` | — | link row (optional) + copyright line |
| link | `a[ngptPageFooterLink]` | — | the link label |

`href`/`target`/`rel` are native, set by the consumer. The copyright line is projected content, not
component-rendered — the spec's own mock has it as the `<footer>`'s text, and under the inversion
that text is the consumer's to author (Home's copy lives in `home.content.ts`).

```html
<!-- docs pages: copyright only -->
<footer ngptPageFooter>Copyright © 2026 NGP Table</footer>

<!-- Home: link row above the copyright line -->
<footer ngptPageFooter>
  <nav aria-label="Footer">
    <a ngptPageFooterLink href="https://github.com/sponsors/…" target="_blank" rel="noopener noreferrer">Sponsor</a>
    <a ngptPageFooterLink href="https://discord.gg/…" target="_blank" rel="noopener noreferrer">Discord</a>
    <a ngptPageFooterLink href="https://github.com/…" target="_blank" rel="noopener noreferrer">GitHub</a>
  </nav>
  Copyright © 2026 NGP Table
</footer>
```

The link row's `<nav aria-label="Footer">` carries no primitive and needs no styling: the strip is a
centered column flex (16px gap), and each link's own 12px inline padding puts adjacent links 24px
apart. `FooterLink` stays in `page-footer.types.ts` as the typed shape for authored link copy.

## Container

| Property | Value | Token |
| --- | --- | --- |
| text-align | center | — |
| padding | 28px | --ngpt-sys-space-700 |
| border-top | 1px solid oklch(0.24 0.005 260) | --ngpt-comp-row-divider |
| font-size | 13px | --ngpt-sys-typescale-label-large-sm |
| color | oklch(0.62 0.01 260) | --ngpt-text-tertiary |



```html
<footer class="page-footer">Copyright © 2026 NGP Table</footer>
```


```css
.page-footer {
  text-align: center;
  padding: 28px;
  font-size: 13px;
  color: var(--ngpt-text-tertiary);
  border-top: 1px solid var(--ngpt-comp-row-divider, oklch(0.24 0.005 260));
}
```


The footer text was `oklch(0.5 0.01 260)`, which measured 3.24:1 at 13px and failed AA. It is now
`--ngpt-text-tertiary` (5.33:1) — the same token the body copy above it uses, since a copyright line at
body contrast is not a hierarchy problem.

Not to be confused with the **Pagination Footer** (prev/next cards) — that lives inside the Content Column, above this page-wide copyright strip.
