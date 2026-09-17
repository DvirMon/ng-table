# ADR-0001: App-local design system, not a shared lib

## Status

Accepted — 2026-08-22

## Context

This round builds token foundations, 16 DS components, and the Home landing page for a new docs/marketing
site (`ng-table`) from a design handoff bundle. There is exactly one consumer app and no cross-app reuse
requirement yet — the docs pages that would justify a second consumer (Doc Article, API Reference, etc.)
are explicitly out of scope this round.

## Decision

The design system lives at `apps/ng-table/src/app/design-system/`, inside the app, not as a `libs/`
package. Layout regions live alongside it at `src/app/layout/`; pages at `src/app/pages/`.

## Rationale

A `libs/` DS library adds project scaffolding, Nx tag rules, and barrel maintenance for zero payoff when
there is one consumer. `apps/issa-landing/src/design-system/` is the in-repo precedent for an app-local
design system. The three-way split (`design-system/` / `layout/` / `pages/`) mirrors the handoff bundle's
own taxonomy (`specs/` components / `specs/layout/` / `specs/pages/`), which keeps spec-to-folder mapping
mechanical.

## Consequences

If a second app needs these components later, the folder lifts into a `libs/` package wholesale — nothing
here assumes app-only usage beyond the folder's location.
