---
title: Spec — withGrouping() (absorbed)
type: spec
status: absorbed 2026-09-20 into `1-state/features/grouping.md` — no longer a contract
date: 2026-09-10
audience: developers
---

# Spec — `withGrouping()` — absorbed

**This file no longer carries a contract.** Its Public surface, Methods, State Shape and group
admission sections were folded into
[`1-state/features/grouping.md`](../../../../features/grouping.md) on 2026-09-20. Go there.

It used to say it _superseded_ `features/grouping.md` — an archived episodic file overriding a
permanent spec, which is what sent every reader on a two-hop chase and is the specific bug the
consolidation fixed.

Its contents were also, by then, stale in three ways the absorbed version corrects: the `schema`
path is keyed by row field rather than `ColumnsPath` (G36), `applyGrouping`'s options were split
into four declarators (G39), and `WithGroupingConfig.rules` no longer exists. The absorbed
contract was written from `src/`, not from this file.

The decisions this spec synthesized are rolled up as **G1–G20** in
[`decisions/grouping.md`](../../../../../decisions/grouping.md), which links back to
[`2-decisions.md`](2-decisions.md) for each one's full rationale.

Kept rather than deleted so existing links and `git log --follow` still resolve.
