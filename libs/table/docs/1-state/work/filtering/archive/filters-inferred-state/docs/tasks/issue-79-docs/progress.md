# Implementation Progress — Reconcile the filters docs with the inferred criterion map

**Issue:** #79
**Status:** 4 / 4 complete

| Step | Title | Status | PR |
|---|---|---|---|
| 1 | Rewrite the filters spec to the shipped surface | ✅ done | #79 |
| 2 | Reconcile the client-side filtering feature doc | ✅ done | #79 |
| 3 | Mark R10, R11, R31, R32 and R33 where they stand | ✅ done | #79 |
| 4 | Correct the remaining surfaces, close #56, regenerate the roll-up | ✅ done | #79 |

Steps 1–3 are parallel-safe with each other; Step 4 depends on Steps 1 and 2.

All four land as one PR — the issue is a single reviewable unit (R46/R47's third unit, "Docs"),
parallel-safe with the code that shipped as #76 and #77.
