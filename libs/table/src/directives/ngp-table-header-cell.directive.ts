import {
  computed,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  type InputSignal,
  type Signal,
} from '@angular/core';

import { NGP_TABLE_FOCUS_REGISTRY } from './focus-registry';
import { NGP_TABLE_STORE } from './table.tokens';

// Separate directive from `NgpTableCellDirective`, not a shared directive with an `isHeader`
// boolean. Header-only concerns (`aria-sort`, sort-trigger affordance) belong here later,
// never on the data-cell directive's public API. `aria-sort` itself stays owned by the sort
// feature directive (`docs/3-ui/cross-cutting/accessibility.md`), not set by this base
// directive.
@Directive({
  selector: 'th[ngpTableHeaderCell], div[ngpTableHeaderCell]',
  host: {
    role: 'columnheader',
    '[attr.aria-colindex]': 'ngpTableHeaderCell() + 1',
    '[attr.tabindex]': 'tabindex()',
  },
})
export class NgpTableHeaderCellDirective {
  // aria-colindex is 1-based per WAI-ARIA; the input is the 0-based column position.
  readonly ngpTableHeaderCell: InputSignal<number> = input.required<number>();

  private readonly table = inject(NGP_TABLE_STORE);
  private readonly focusRegistry = inject(NGP_TABLE_FOCUS_REGISTRY, { optional: true });
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  // Read through `renderColumns()`: a hidden column shifts every index.
  private readonly columnId: Signal<string | undefined> = computed(
    () => this.table.ngpTable().renderColumns()[this.ngpTableHeaderCell()]?.id,
  );

  constructor() {
    // Registers this header's element for DOM focus; the cleanup also runs on destroy.
    effect((onCleanup) => {
      const columnId = this.columnId();
      const registry = this.focusRegistry;
      if (registry === null || columnId === undefined) return;

      registry.register({ area: 'header', columnId }, this.element);
      onCleanup(() => registry.unregister(this.element));
    });
  }

  // Roving tabindex: a Tab stop only while `activeTarget` is this column's header.
  protected readonly tabindex: Signal<0 | -1> = computed((): 0 | -1 => {
    const target = this.table.activeTarget();
    const isActiveHeader = target?.area === 'header' && target.columnId === this.columnId();
    return isActiveHeader ? 0 : -1;
  });
}
