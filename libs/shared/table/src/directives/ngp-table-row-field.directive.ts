import {
  Directive,
  effect,
  inject,
  input,
  TemplateRef,
  ViewContainerRef,
  type EmbeddedViewRef,
  type InputSignal,
} from '@angular/core';
import type { FieldTree } from '@angular/forms/signals';

import { resolveRowField } from './ngp-table-row-field.resolve';
import type { RenderRow } from '../api/types';

export interface NgpTableRowFieldContext<TRow> {
  // Not readonly: the directive mutates these in place on `sourceIndex` change instead of
  // recreating the embedded view (matches `NgIfContext`'s own mutable-field pattern).
  $implicit: FieldTree<TRow>;
  ngpTableRowField: FieldTree<TRow>;
}

/**
 * Structural directive folding `@if (row.sourceIndex !== undefined) { @let field =
 * rows[row.sourceIndex]; }` into one template line. Exported from the `@acme/table/forms`
 * secondary entry point, not the root barrel — the root stays forms-free even at type level.
 */
@Directive({ selector: '[ngpTableRowField]' })
export class NgpTableRowFieldDirective<TRow> {
  private readonly templateRef =
    inject<TemplateRef<NgpTableRowFieldContext<TRow>>>(TemplateRef);
  private readonly viewContainerRef = inject(ViewContainerRef);

  private viewRef: EmbeddedViewRef<NgpTableRowFieldContext<TRow>> | null = null;

  readonly ngpTableRowField: InputSignal<RenderRow<TRow>> = input.required<RenderRow<TRow>>();
  readonly ngpTableRowFieldFrom: InputSignal<FieldTree<TRow[]>> =
    input.required<FieldTree<TRow[]>>();

  static ngTemplateContextGuard<TRow>(
    _dir: NgpTableRowFieldDirective<TRow>,
    _ctx: unknown
  ): _ctx is NgpTableRowFieldContext<TRow> {
    return true;
  }

  constructor() {
    effect(() => {
      const field = resolveRowField(this.ngpTableRowFieldFrom(), this.ngpTableRowField());
      if (field === undefined) {
        this.viewRef = null;
        this.viewContainerRef.clear();
        return;
      }
      if (this.viewRef === null) {
        this.viewRef = this.viewContainerRef.createEmbeddedView(this.templateRef, {
          $implicit: field,
          ngpTableRowField: field,
        });
        return;
      }
      this.viewRef.context.$implicit = field;
      this.viewRef.context.ngpTableRowField = field;
    });
  }
}
