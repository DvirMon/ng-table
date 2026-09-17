# AGENT.md

## Stack

- Angular 22.1.2 — standalone, zoneless, signals, `OnPush`, new control flow, CSS (no SCSS)
- Nx 23.1.1 (`project.json` per project, no `angular.json`)
- TypeScript 6.0.3, Vitest 4.1.9, Storybook 10.5.9 (`@storybook/angular-vite`), ESLint 9 + angular-eslint
- npm, Node >= 22.6 (`--experimental-strip-types` scripts)

## Commands

```bash
npx nx serve ng-table                 # port 4202
npx nx run shared-table:storybook     # port 4403
npx nx test shared-table
npx nx run <project>:typecheck        # ngc — template-aware; never bare tsc on Angular projects
npx nx run-many -t lint
npm run table:overloads:check         # generated createTable() overloads are in sync
npm run llms:check                    # llms.txt is in sync
```

## Projects

| Nx project | Path | Entry doc |
|---|---|---|
| `shared-table` | `libs/table` | `libs/table/CLAUDE.md` |
| `ng-table` | `apps/site` | `apps/site/CLAUDE.md` |

Import alias: `@ngp/table`, `@ngp/table/forms` (`tsconfig.base.json`).

## Map

- `llms.txt` — generated context map (`npm run llms`); one entry per project `CONTEXT.md`.
- `.claude/rules/` — file organization, encapsulation extraction, template-aware typecheck.
- `docs/agents/knowledge-base/` — how the table lib's docs are structured and groomed.
