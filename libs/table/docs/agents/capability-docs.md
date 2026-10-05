# Consolidating one capability's docs

The procedure that converts a capability whose docs have spread across work folders, specs,
plans and ADRs into the **two permanent files** every capability is supposed to have:

| File                                                                                 | Answers                                                  |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| `docs/1-state/features/<capability>.md` (and `docs/3-ui/directives/<capability>.md`) | what it does **today**                                   |
| `docs/decisions/<capability>.md`                                                     | **why**, what was tried, what was reversed, what is open |

The log's own contract — numbering, status vocabulary, the four maintenance rules — is
`~/.claude/conventions/doc-contracts/decisions-log.md`, which is portable across repos. This
file is the repo-specific procedure that produces a log conforming to it.

Run once per capability. `grouping` was the first (2026-09-20, `951379d`) — read its log and
contract as the worked example before starting another.

## Entry point

`/audit-docs <capability>` — `audit-docs` routes here when its scope is a capability name
rather than a file path. Steps 2 and 3 below _are_ an `audit-docs` run; the rest is structural
work `audit-docs` does not do.

## Procedure

### 1. Inventory every file that touches the capability

Dispatch the `discovery` agent. Findings go to
`docs/1-state/work/<capability>/active/doc-consolidation/doc-inventory-<date>.md`, never to
chat. Ask it for: every file mentioning the capability, every decision log it carries with that
log's own numbering, every ADR that constrains it, and which permanent docs contradict each
other.

Create the work folder and its `state.json` first, per `/to-ticket`'s format.

### 2. Verify the inventory against source — do not skip this

**The inventory's claims about what shipped are its least trustworthy part.** An inventory is
built by reading docs, and the docs are what you are here to fix.

Two failures that actually happened on `grouping`, both caught only by checking:

- A plan's frontmatter read `approved, not started` for work that had shipped three days
  earlier. The symbol it introduced was already exported from `src/index.ts`. **Check `src/`
  and `git log`, never a doc's own `status:` or a work folder's `state.json`.**
- ADR statuses were reported unverifiable because "only four ADRs carry a `status:` field."
  The grep had looked for YAML `status:`; most ADRs here carry `**Status:**` in bold on line 3.
  **A negative result from one grep pattern is not a fact.**

Fold the corrections into the inventory as a dated banner with new source rows. Do not silently
rewrite it — the corrections are evidence for step 3.

### 3. Roll every decision up into one log

Read each source's decision list in full and emit one row per decision into a single
chronological table under the capability's own prefix. Then:

- **Make supersession explicit.** Two sources deciding the same thing differently is the normal
  case, not an anomaly. The later row wins; the earlier row's **Status** is edited to point
  forward. Partial reversal names the half (`shipped · call-order half reversed by G33`).
- **Keep the source `D`-number** in the Record column, so existing cross-references resolve.
- **Carry open questions across as rows**, with a `Still open` section saying what closes each.
  An open question whose stated deadline has already passed is a finding — say so in the row.
- **Restate nothing.** A row that needs a second line means the second line belongs in the
  linked record.

### 4. Settle the contract against `src/` — rewrite or correct, depending

Open the feature's source folder and write the public-surface block **from it**. Never from a
spec: archived specs are the reason you are here, and treating one as input propagates whatever
was wrong with it.

Which of two jobs this is depends on what the permanent spec actually is:

| The permanent spec is…                                      | Do                                                      |
| ----------------------------------------------------------- | ------------------------------------------------------- |
| missing, a stub, or delegating its contract into `archive/` | **rewrite it** wholesale from `src/`                    |
| a real contract that is stale in identified places          | **correct those places** against `src/`, leave the rest |

`grouping` was the first case — 70 lines of superseded banner over a draft that delegated its
own contract to an archived file. `row-editing` was the second: 670 lines that were mostly
right and stale in five verified spots. Rewriting the second would have destroyed more than it
fixed. Decide which case you are in before writing anything, and say which in the commit.

On `grouping` this caught three stale facts in the archived spec, including a config member
that no longer existed — which in turn revealed that an open decision's stated deadline
("decide before Phase B deletes it") had already passed unsettled.

Keep the `capability:` / `spec:` / `code:` frontmatter values unless the code genuinely
disagrees with them. They feed `docs/status.md`; changing one during a docs reorg silently
moves a number on a generated roll-up.

### 5. Demote any permanent doc that claims to override the contract

An archived file that says it _supersedes_ the permanent spec is the core defect — the
permanent file ends up delegating its own contract into `archive/`. Gut it to a short tombstone
naming its replacement and listing how it was stale. Keep the file so links and `git log
--follow` still resolve; never delete it.

Strip wrong claims from the sibling UI doc rather than correcting them in place, and say in a
dated banner what was removed and why.

### 6. Move episodic work under the capability, archive what shipped

Target layout:

```
docs/1-state/work/<capability>/
  active/<slug>/      ← in flight
  archive/<slug>/     ← shipped, rolled up
docs/3-ui/work/archive/<slug>/
```

Use `git mv` so history follows. **On Windows, `git mv` on a directory fails with "Permission
denied"** — iterate `git ls-files` and move each file individually, creating target
subdirectories as you go.

A folder moves to `archive/` only once every decision in it is a row in the log. That gate is
in `libs/table/CLAUDE.md`.

### 7. Repair every pointer the moves broke

- `state.json` in each moved folder: `workspaceRoot`, `decisionsPath`, `specPath`, `planPath`.
  Flip any `checklist` field the move proves stale.
- Cross-doc relative links, in both directions — ADRs citing a work folder, plans citing each
  other.
- Verify with a link checker over the whole capability, not only the files you wrote.

**A bulk path rewrite has two traps, both hit on the `row-editing` run.**

1. **It rewrites prose that quotes the old path on purpose.** A sentence like "links still
   pointing at `work/<old-slug>/`" becomes a sentence naming the new path, which inverts its
   meaning. After any sweep, diff the non-link hits and read them. Citations in prose _should_
   be updated; descriptions of the old layout should not.
2. **On Windows, `Set-Content -Encoding utf8` writes a BOM** — and `tools/generate-status.ts`
   tests `lines[0].trim() === '---'`, so a BOM makes the frontmatter unparseable and the
   capability **silently vanishes from `docs/status.md`**. It also flips LF to CRLF. Use
   `[System.IO.File]::WriteAllText($p, $text, (New-Object System.Text.UTF8Encoding($false)))`
   and check the first three bytes afterwards. A capability missing from the roll-up is much
   harder to notice than a broken link.

Fix only the links this capability owns. A repo-wide sweep pulls in every other capability's
damage and makes the run unreviewable — count what is left, say which capabilities own it, and
register that in the log.

### 8. Regenerate, then hand back

`npm run table:status` and `npm run llms` are the user's to run. State what is worth running
and stop.

`status.md` may pick up drift unrelated to this capability — say so in the commit body rather
than presenting it as part of the consolidation.

## Acceptance

- Exactly two permanent files answer the capability, and neither delegates its contract into
  `archive/`.
- The log conforms to `doc-contracts/decisions-log.md`: own numbering, one line per row, every
  supersession expressed in a Status cell.
- Every decision in every `active/` folder for this capability has a row.
- `docs/status.md` links the log for this capability (generated — see `tools/generate-status.ts`).
- The contract names the capability's most common wrong assumption explicitly. For `grouping`
  that is "grouping never reads a column's `accessor`" — the thing an agent would otherwise
  infer from the surrounding code and get wrong.

## What this does not do

Nothing about the docs _axis_. Whether a capability's decisions, spec and work should all live
under `docs/features/<capability>/` rather than split across numbered streams is a separate,
parked question — do not reopen it inside one capability's cleanup.
