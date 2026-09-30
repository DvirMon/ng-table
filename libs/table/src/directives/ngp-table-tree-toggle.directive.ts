import {
  afterNextRender,
  computed,
  Directive,
  ElementRef,
  inject,
  type Signal,
} from '@angular/core';

import { NGP_TABLE_ROW, NGP_TABLE_STORE } from './table.tokens';
import type { TreeMembers } from '../api/features/with-tree/types';

function hasTree(table: unknown): table is TreeMembers {
  if (typeof table !== 'object' || table === null || !('tree' in table)) return false;
  return typeof table.tree === 'function' && 'toggle' in table.tree;
}

function assertTreeComposed(table: unknown): void {
  if (typeof ngDevMode === 'undefined' || !ngDevMode) return;
  if (hasTree(table)) return;
  throw new Error(
    'ngpTableTreeToggle requires a table created with withTree(); add withTree() to createTable().',
  );
}

function hasAccessibleName(button: HTMLElement): boolean {
  const isLabelled = button.hasAttribute('aria-label') || button.hasAttribute('aria-labelledby');
  const hasText = (button.textContent ?? '').trim() !== '';
  return isLabelled || hasText;
}

function warnWhenNameless(button: HTMLElement, isLeaf: Signal<boolean>): void {
  afterNextRender(() => {
    if (typeof ngDevMode === 'undefined' || !ngDevMode) return;
    if (isLeaf() || hasAccessibleName(button)) return;
    console.warn(
      'ngpTableTreeToggle: the button has no accessible name. Add aria-label, aria-labelledby or text.',
    );
  });
}

/** Toggles its row through `table.tree.toggle()` and owns the button's state attributes. */
@Directive({
  selector: 'button[ngpTableTreeToggle]',
  host: {
    '(click)': 'toggle()',
    '[attr.aria-expanded]': 'ariaExpanded()',
    '[attr.data-expanded]': 'isOpen() ? "" : null',
    '[attr.disabled]': 'isLeaf() ? "" : null',
    '[attr.aria-hidden]': 'isLeaf() ? "true" : null',
    '[attr.data-disabled]': 'isLeaf() ? "" : null',
  },
})
export class NgpTableTreeToggleDirective {
  private readonly row = inject(NGP_TABLE_ROW);
  private readonly table = inject(NGP_TABLE_STORE);
  private readonly host = inject<ElementRef<HTMLButtonElement>>(ElementRef);

  protected readonly isLeaf: Signal<boolean> = computed(
    (): boolean => this.row.ngpTableRow().hasChildren !== true,
  );
  protected readonly isOpen: Signal<boolean> = computed(
    (): boolean => this.row.ngpTableRow().isExpanded === true,
  );
  protected readonly ariaExpanded: Signal<'true' | 'false' | null> = computed(() => {
    if (this.isLeaf()) return null;
    return this.isOpen() ? 'true' : 'false';
  });

  constructor() {
    assertTreeComposed(this.table.ngpTable());
    warnWhenNameless(this.host.nativeElement, this.isLeaf);
  }

  protected toggle(): void {
    const table = this.table.ngpTable();
    if (hasTree(table)) table.tree.toggle(this.row.ngpTableRow().id);
  }
}
