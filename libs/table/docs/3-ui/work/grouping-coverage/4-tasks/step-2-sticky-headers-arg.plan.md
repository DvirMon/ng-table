# Step 2 — `stickyHeaders` arg on `grouping-basic/`

**Task type:** code
**Stack:** angular
**Parallel-safe with:** Steps 1, 3, 4, 7

## Why

`grouping-story.css:176-181` defines an opt-in sticky rule for group headers. It was applied by
`grouping-static/`, which was deleted in the story restructure, and **nothing references it
now** — dead CSS, and `0-product/grouping.md` §2.4 ("Keep my place while scrolling a long
group") lost its only demo, dropping 🟡 → ❌.

Decision D3: restore it as an arg on `grouping-basic/`. Sticky headers are a CSS recipe over
`data-row-kind`, not a grouping API option — the same category as the existing `showCount` arg —
so this adds no second lesson to the baseline story.

## Files

- `libs/table/src/stories/grouping/grouping-basic/grouping-basic-story-host.component.ts`
- `libs/table/src/stories/grouping/grouping-basic/grouping-basic-story-host.component.html`
- `libs/table/src/stories/grouping/grouping-basic/grouping-basic.stories.ts`

## What to do

**Host `.ts`** — add beside the existing `showCount` input:

```ts
readonly stickyHeaders = input(false);
```

Default `false`: the baseline story's job is the grouping API, and a table that scroll-pins on
first paint is a surprise, not a lesson.

**Template** — line 72 is currently bare:

```html
<table class="story-host__table grouping-story__table">
```

Add the conditional class:

```html
<table
  class="story-host__table grouping-story__table"
  [class.grouping-story__table--sticky]="stickyHeaders()"
>
```

**`.stories.ts`** — mirror the existing `showCount` pair exactly:

```ts
argTypes: {
  showCount: { control: 'boolean' },
  stickyHeaders: { control: 'boolean' },
},
args: {
  showCount: true,
  stickyHeaders: false,
},
```

## What this does and does not prove

The CSS targets `[data-row-kind='group'] > .story-host__cell` — the *group* header rows, not
`<thead>`. That is what §2.4 asks for: "the group header stays visible while any of its rows are
on screen."

Every depth pins to `top: 0`, so with nested groups an inner header lands *on* its parent rather
than stacking beneath it. §2.4's second and third criteria (the full path visible, a clean
hand-off) stay unmet, which is UI-layer gap **U5**. **§2.4 returns to 🟡, not ✅.** Do not claim
otherwise in step 5, and do not attempt the per-depth offset here — it needs a decision and it
collides with virtual scroll.

## Acceptance checks

- [ ] `nx run shared-table:typecheck` clean (second, source-clean run if the first aborts in
      `.ts`).
- [ ] `grouping-story__table--sticky` is referenced by exactly one template.
- [ ] No other grouping host gains the arg — this is `grouping-basic/`'s alone.
- [ ] `grouping-story.css` is unmodified; the rule already exists and is correct.
