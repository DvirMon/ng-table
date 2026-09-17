---
globs:
  - "libs/**/*.ts"
  - "apps/**/*.ts"
  - "apps/**/*.html"
  - "libs/**/*.html"
  - "apps/**/*.tsx"
  - "libs/**/*.tsx"
---

> **Codified globally** (generalized, glob frontmatter stripped) in `~/.claude/rules/extract-encapsulated-logic.md` (2026-08-30) — this is now the acme-specific glob-scoped copy, kept for that reason.

# Extract encapsulated logic, reuse not required

While generating or editing a component/hook/service, watch for inline logic that has become
its own coherent scope — even when nothing else will ever consume it. Reuse potential is not
the test. The test is: **does this logic have its own state, its own lifecycle, or its own
reasoning that's separable from its host?** If yes, pull it into its own named function (same
file) or its own file/directive/hook (own scope), regardless of whether it's called from one
place or ten.

This keeps the host lean and gives the extracted piece a name a reader can reason about without
also holding the host's other concerns in their head.

## Signals that logic has its own scope

- **Owns a lifecycle** — acquire/release, subscribe/cleanup, schedule/cancel: a listener
  registered and torn down, a timer started and cleared, a subscription opened and closed. The
  acquire and release halves belong together, away from the host's other setup.
- **Owns state that isn't the host's** — a computed value, a derived flag, or a piece of local
  state whose only relationship to the host is "the host reads it," not "the host reasons about
  it."
- **Would need a comment to explain what a block does** — the comment belongs in the extracted
  function's name instead.
- **Independently testable** — if you'd want a unit test for just this piece without mounting
  the whole host, it's a sign it should be a named export.

This applies framework-agnostically: an Angular directive built around `afterNextRender` +
`DestroyRef` cleanup, a React `useRef` + `useEffect` pair, a Node service's polling loop — same
shape, same test, regardless of which acquire/release primitives the framework hands you. Don't
enumerate a case per framework; the mechanism is the same one.

Same test applies to markup, not just logic: a repeated `@for`/`.map()` cell with its own
internal shape (a grid article, a list row) is its own scope too — pull it into its own
`ng-template`/component or JSX component, reuse not required.

## Don't extract when

- The logic is a single expression or trivial one-line transform, with no independent meaning
  (over-extraction produces a maze of one-line indirections).
- Extraction would require passing back most of the host's local state anyway — no real seam
  exists yet.

## Guard against over-extraction

Extraction is a trade: a name in exchange for a jump. Only take that trade when the jump is
worth it. The test each time is net reading cost — does pulling this out make the host easier
to hold in your head, or does it just relocate the same three lines behind an indirection the
reader now has to chase?

Signals you've gone too far:
- Reading one flow now means opening 3+ files/functions with no independent reasoning of their
  own — each is a thin pass-through, not a scope.
- The extracted piece takes most of the host's state as parameters — it never had its own scope,
  extraction just added a call boundary.
- You extracted because the block was *long*, not because it *owned* something (state,
  lifecycle, a name worth reasoning about independently). Length alone is not the test in this
  rule — the state/lifecycle/reasoning test above is.

When in doubt between inlining and extracting, and the block has no lifecycle/state of its own,
default to inline. A slightly longer host that reads top-to-bottom beats a maze of one-call
functions/components that all say "look elsewhere."

## Where it goes

- Same file, named function/hook: the default when the extracted piece is small and has no
  reason to be found independently of its host.
- Its own file (own scope — an attribute directive, a `use<Thing>` hook, a `.utils.ts` export):
  once the extracted piece has inputs/state of its own worth naming at the file level, or per
  `file-organization.md`'s concern-to-filename mapping.

`file-organization.md` governs *where a file goes once something is worth its own file*. This
rule governs the earlier question — *whether something should be pulled out of its host's scope
at all*, file or no file.
