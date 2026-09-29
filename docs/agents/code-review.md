# Code review config

Read by the `code-review` plugin (`code-review@ai-coding-guidelines`) —
locally and in `.github/workflows/claude-review.yml`. Keys follow the
plugin's `routing.md`; missing keys fall back to its defaults.

```yaml
contexts:
  library:
    paths: [libs/table/**]
    kind: library
    public-surface: [libs/table/src/index.ts]      # ADR-0004: the only barrel
    typecheck: nx run shared-table:typecheck
  site:
    paths: [apps/site/**]
    kind: app
    typecheck: nx run ng-table:typecheck

a11y:
  mode-by-path:
    libs/table/src/directives/**: design-system
    apps/site/src/app/design-system/**: design-system
    apps/site/**: feature
  contracts:
    - libs/table/docs/3-ui/cross-cutting/accessibility.md

knowledge:
  skills: [angular-developer]
  standards:
    - CLAUDE.md
    - libs/table/CLAUDE.md
    - apps/site/CLAUDE.md
    - apps/site/docs/CONVENTIONS.md
    - .claude/rules/
    - libs/table/CONTEXT.md       # glossary: a term used against its definition is a standards finding
    - apps/site/CONTEXT.md
  decisions:
    - libs/table/docs/adr/
    - libs/table/docs/decisions/
    - apps/site/docs/adr/
  commit-rule: docs/agents/issue-tracker.md#issue-references

performance:
  hot-paths:
    - libs/table/src/engine/**
    - libs/table/src/directives/**

reviewers:
  disable: []
  extra-references:
    - path: libs/table/docs/3-ui/cross-cutting/styling-tokens.md
      for: styles-reviewer

spec:
  issue-contract: docs/agents/issue-tracker.md
  issue-workspace: "libs/table/docs/*/work/*/*/*/4-tasks/issue-{n}-*/"
  doc-names: [spec.md, narrative.md, decisions.md]
```

## Notes

- `typecheck` is what the hand-off runs once after applying fixes — the
  template-aware `ngc` target, never bare `tsc`
  (`.claude/rules/typecheck-angular-templates.md`).
- `issue-workspace`: `{n}` is the issue number from `Refs: #N` /
  `Closes #N`. The step files and spec in that folder are spec sources
  for that issue, next to the issue body.
- `commit-rule` covers commit scope and trailers; the header format is
  already enforced by `.githooks/` and `pr-conventions`, so the review
  checks only one-concern-per-commit and message-matches-change.
