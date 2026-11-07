import {
  computed,
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  type InputSignal,
  type Signal,
} from '@angular/core';

import { NGP_TABLE_FOCUS_REGISTRY } from './focus-registry';
import { NGP_TABLE_ROW, NGP_TABLE_ROW_MOVE, NGP_TABLE_STORE } from './table.tokens';
import type { RenderRow, RowId } from '../api/types';

/**
 * Marks a `<tr>` or `<div>` as a table row and binds its kind, depth and `aria-rowindex`.
 *
 * @remarks
 * Sets `role="row"` on either host tag. Under a treegrid the row is also a focus target and
 * carries the roving `tabindex`; group rows are not. Registers its element with
 * `ngpTableRowMove` when the host table has one.
 *
 * @example
 * <tr [ngpTableRow]="row">…</tr>
 */
@Directive({
  selector: 'tr[ngpTableRow], div[ngpTableRow]',
  providers: [{ provide: NGP_TABLE_ROW, useExisting: NgpTableRowDirective }],
  host: {
    role: 'row',
    '[attr.data-row-kind]': 'ngpTableRow().kind',
    '[attr.data-depth]': 'ngpTableRow().depth',
    // aria-rowindex is 1-based per WAI-ARIA; `ngpTableRow().index` is the 0-based array position.
    '[attr.aria-rowindex]': 'ngpTableRow().index + 1',
    '[attr.tabindex]': 'tabindex()',
    '[style.--ngp-table-row-depth]': 'ngpTableRow().depth',
  },
})
export class NgpTableRowDirective<TRow = unknown> {
  /** The render row this element shows. */
  readonly ngpTableRow: InputSignal<RenderRow<TRow>> = input.required<RenderRow<TRow>>();

  /** The id of the bound row. */
  readonly rowId: Signal<RowId> = computed(() => this.ngpTableRow().id);
  /** Whether the bound row is a group header rather than a data row. */
  readonly isGroupHeader: Signal<boolean> = computed(() => this.ngpTableRow().kind === 'group');

  // Optional: absent when the host table has no `ngpTableRowMove` directive.
  private readonly rowMove = inject(NGP_TABLE_ROW_MOVE, { optional: true });
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly table = inject(NGP_TABLE_STORE, { optional: true });
  private readonly focusRegistry = inject(NGP_TABLE_FOCUS_REGISTRY, { optional: true });

  // Note: a row is a focus target only under `treegrid`, and never a group row. In a grid
  // it registers nothing and binds no attribute.
  private readonly isRowStop: Signal<boolean> = computed(
    () => this.table?.isTreegrid() === true && !this.isGroupHeader(),
  );

  protected readonly tabindex: Signal<0 | -1 | null> = computed((): 0 | -1 | null => {
    if (!this.isRowStop()) return null;
    const target = this.table?.activeTarget();
    const isActiveRow =
      target?.area === 'body' && target.columnId === null && target.rowId === this.rowId();
    return isActiveRow ? 0 : -1;
  });

  constructor() {
    const element = this.host.nativeElement;

    // `rowId()` reads the required `ngpTableRow` input, unset until after construction — defer
    // via `effect()`.
    // `@for` tracks by row id, so this instance's id never changes and the effect runs exactly
    // once.
    effect(() => {
      this.rowMove?.registerRowElement(this.rowId(), element);
    });

    effect((onCleanup) => {
      const registry = this.focusRegistry;
      if (registry === null || !this.isRowStop()) return;

      registry.register({ area: 'body', rowId: this.rowId(), columnId: null }, element);
      onCleanup(() => registry.unregister(element));
    });

    inject(DestroyRef).onDestroy(() => {
      this.rowMove?.unregisterRowElement(this.rowId(), element);
    });
  }
}
