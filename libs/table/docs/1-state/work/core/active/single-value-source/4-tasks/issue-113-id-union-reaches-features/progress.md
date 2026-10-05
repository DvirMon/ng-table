# Implementation Progress — the declared column-id union reaches a feature's config

**Issue:** [#113](https://github.com/DvirMon/ng-table/issues/113)
**Status:** 4 / 4 complete

| Step | Title                                       | Status  | PR  |
| ---- | ------------------------------------------- | ------- | --- |
| 1    | `TId` survives on the store shape           | ✅ done | —   |
| 2    | The generator carries `TId` into every slot | ✅ done | —   |
| 3    | The literal-union guard                     | ✅ done | —   |
| 4    | Record the escape-hatch decision            | ✅ done | —   |

## Graph

```
1 ──► 2 ──► 3 ──► 4
```

No parallel-safe pairs. Step 2 emits a type Step 1 must declare; Step 3
asserts the `string` fallback instead of the real union until Step 2
lands; Step 4 is written from what Step 3 proved.

## Gate

Step 3 is what [#114](https://github.com/DvirMon/ng-table/issues/114),
[#115](https://github.com/DvirMon/ng-table/issues/115) and
[#100](https://github.com/DvirMon/ng-table/issues/100) wait on — not
Step 1. The union reaching a slot is not the same as the union being
proven literal, and the failure mode in between is silent.
