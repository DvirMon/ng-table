# ADR-0002: No barrels in the design system

## Status

Accepted — 2026-08-22

## Context

The DS build ran as ~25 parallel subagent tasks across five waves. A shared `design-system/index.ts`
barrel, edited by every component agent to add its own export, is a guaranteed write-collision point —
every parallel agent in a wave would need to touch the same file.

## Decision

No barrels anywhere in `design-system/`, `layout/`, or `pages/`. Consumers import directly from each
component's file: `import { PillButton } from '../../design-system/pill-button/pill-button';`.

## Rationale

Removes the one shared mutable file parallel agents would otherwise contend over. Each agent's write set
stays confined to its own folder, which is the collision rule the whole wave plan depends on
(`docs/design-handoff/README.md` build order + the session's wave plan).

## Consequences

Import paths are longer and not centrally discoverable from one file. If that becomes a real cost, a
barrel can be added in one pass once parallel building is done — nothing here blocks adding one later.
