# ADR-0004: Icons registered locally per component, not globally

## Status

Accepted — 2026-08-22

## Context

`specs/foundations/Iconography.md` specifies ng-icons with the Lucide pack (`@ng-icons/core` +
`@ng-icons/lucide`, installed in Wave 0; neither was in the repo before). A global icon registry would be
wired once in `app.config.ts` via `provideIcons({...})` with every icon the site uses.

## Decision

No global icon registry. Each icon-using component (`icon-button`, `callout`, `search`, `navbar`, …)
declares its own `viewProviders: [provideIcons({ lucideX, ... })]` with just the glyphs it needs.

## Rationale

`app.config.ts` would otherwise be a second shared write-collision file every icon-using component's
agent needs to touch (see ADR-0002 for the same problem with barrels). Local registration also tree-shakes
per component rather than bundling every icon the site could ever use.

## Consequences

The same icon registered by two components is duplicated in two `viewProviders` arrays rather than
declared once. Given the icon set here is small (a few dozen glyphs across ~6 icon-using components), the
duplication cost is low against the collision-avoidance benefit.
