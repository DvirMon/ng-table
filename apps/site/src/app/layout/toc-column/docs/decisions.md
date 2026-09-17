# Decisions — TOC Column

**Desktop-only, no scroll-spy this pass.** Mirrors the sidebar's scope call: structural piece only
(container, label, item list, active/nested styling via `activeId` input). `IntersectionObserver`-driven
scroll-spy needs a real scrollable article to observe — none exists yet (`DocPlaceholder` has no prose
content). Follow-up once `Content Prose` articles ship.

**State via `[data-active]`/`[data-nested]` attributes, not the spec's illustrative `.is-active`/
`.toc-item--nested` classes.** The spec's own CSS block is a generic reference, not Angular-specific;
`CONVENTIONS.md`'s house rule (state via `data-*` host/attr bindings, never classes) takes precedence,
same call `nav-item` already made for `[data-active]`/`[data-nested]`.

**Items are plain `<a href="#id">` inline in the template, not a separate atom.** A TOC row has no
independent state or lifecycle of its own (per `.claude/rules/extract-encapsulated-logic.md`) — it's a
templated cell, same reasoning as the sidebar's rows before those became `nav-item` (which earned its own
component because `nav-item` is *reused* across sidebar and elsewhere with its own active/nested API).
No reuse case exists for a toc-item yet; revisit if one appears.

**Mock headings shaped after `libs/shared/table/src/api/row-edit-mutations.ts`'s updaters** (`beginEdit`,
`addNewRow`, `endEdit`, `clearEditing`, `revertEdit`, `rebaseEdit`, `settleEdit`), since that's the
concrete example discussed for the `/state-layer/row-editing` article this TOC would eventually serve.
One H3 (`Snapshot resolution`, nested under `revertEdit`) included to exercise the nested-item treatment.
