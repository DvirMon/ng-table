// Secondary entry point — `@acme/table/forms`. Everything here is Signal-Forms-typed and
// opt-in; the root barrel (`../index.ts`) stays forms-free even at type level. See D33,
// `docs/1-state/work/with-row-editing/2-decisions.md`.
export {
  NgpTableRowFieldDirective,
  type NgpTableRowFieldContext,
} from '../directives/ngp-table-row-field.directive';
