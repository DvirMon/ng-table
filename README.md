# ng-table

Nx workspace for **`@ngp/table`** — a signal-based, attribute-only data table engine for Angular — and its docs site.

| Project | Path | What it is |
|---|---|---|
| `shared-table` | `libs/table` | The library: `createTable()` store engine, column schema, `ngp*` directives, `with-*()` feature plugins. Zero runtime deps beyond Angular + RxJS. |
| `ng-table` | `apps/site` | Docs / landing site for the library (Angular, app-local design system). |

Each project owns its own `CLAUDE.md`, `CONTEXT.md` and `docs/adr/`. Start at `llms.txt` for the map.

## Commands

```bash
npm install
npm start                     # ng-table docs site, http://localhost:4202
npm run table:sb              # shared-table Storybook, http://localhost:4403
npx nx test shared-table
npx nx run-many -t lint typecheck
npm run table:status          # regenerate libs/table/docs/status.md
npm run table:overloads       # regenerate createTable() overloads
npm run llms                  # regenerate llms.txt
```

## Origin

Extracted from the `acme` monorepo (`DvirMon/acme`) with history preserved. Docs that mention `apps/demo`, `apps/issa-landing` or `libs/shared/design-system` refer to that repo.
