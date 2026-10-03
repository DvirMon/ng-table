import {
  computed,
  Directive,
  ElementRef,
  inject,
  input,
  type OnChanges,
  type OnDestroy,
  type OnInit,
  Renderer2,
  type Signal,
  type SimpleChanges,
} from '@angular/core';

import { NGP_TABLE_PANEL_REGISTRY } from './panel-registry';
import { NGP_TABLE_STORE } from './table.tokens';
import type { ExpansionMembers } from '../api/features/with-expansion';
import type { RowId } from '../api/types';

function hasExpansion(table: unknown): table is ExpansionMembers {
  if (typeof table !== 'object' || table === null || !('expansion' in table)) return false;
  return typeof table.expansion === 'function' && 'expand' in table.expansion;
}

function assertExpansionComposed(readTable: () => unknown): void {
  if (typeof ngDevMode === 'undefined' || !ngDevMode) return;
  if (hasExpansion(readTable())) return;
  throw new Error(
    'ngpTablePanel requires a table created with withExpansion(); add withExpansion() to createTable().',
  );
}

/**
 * Marks an element as the detail panel of one row.
 *
 * @remarks
 * Mints a table-scoped `id` that stays the same across close and reopen, and sets the
 * `inert` attribute while the row is closed. Escape inside the panel calls `close()`
 * unless the event was already handled. Note: throws in dev mode unless the table
 * composes `withExpansion()`, and when a second panel registers for the same row.
 *
 * @example
 * <div [ngpTablePanel]="row.id" role="region"></div>
 */
@Directive({
  selector: '[ngpTablePanel]',
  host: {
    '[id]': 'panelId',
    '[attr.inert]': 'isOpen() ? null : ""',
    '(keydown.escape)': 'onEscape($event)',
  },
  exportAs: 'ngpTablePanel',
})
export class NgpTablePanelDirective implements OnChanges, OnInit, OnDestroy {
  /** Id of the row this element is the detail panel for. */
  readonly ngpTablePanel = input.required<RowId>();

  private readonly table = inject(NGP_TABLE_STORE);
  private readonly registry = inject(NGP_TABLE_PANEL_REGISTRY);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);

  protected panelId = '';
  private registeredId: RowId | null = null;

  protected readonly isOpen: Signal<boolean> = computed((): boolean => {
    const table = this.table.ngpTable();
    return hasExpansion(table) && table.expansion().has(this.ngpTablePanel());
  });

  ngOnChanges(changes: SimpleChanges): void {
    const change = changes['ngpTablePanel'];
    const isChangedAfterInit = change !== undefined && !change.firstChange;
    const isMovedAfterInit = isChangedAfterInit && this.registeredId !== null;
    if (!isMovedAfterInit) return;
    const id = this.ngpTablePanel();
    this.panelId = this.registry.movePanel(this.host.nativeElement, id);
    this.registeredId = id;
  }

  ngOnInit(): void {
    assertExpansionComposed(() => this.table.ngpTable());
    const id = this.ngpTablePanel();
    this.panelId = this.registry.registerPanel(id, this.host.nativeElement);
    this.registeredId = id;
  }

  /** Collapses this panel's row and returns focus to its toggle when focus was inside or lost. */
  close(): void {
    const table = this.table.ngpTable();
    if (hasExpansion(table)) table.expansion.collapse([this.ngpTablePanel()]);
    this.returnFocus(this.ngpTablePanel(), { allowBody: true });
  }

  protected onEscape(event: Event): void {
    if (event.defaultPrevented) return;
    this.close();
    event.preventDefault();
  }

  private returnFocus(id: RowId, { allowBody }: { allowBody: boolean }): void {
    const active = document.activeElement;
    const isFocusInside = active !== null && this.host.nativeElement.contains(active);
    const isFocusLost = allowBody && (active === null || active === document.body);
    if (!isFocusInside && !isFocusLost) return;
    const toggle = this.registry.toggleOf(id);
    if (toggle !== null && toggle.isConnected) toggle.focus();
  }

  ngOnDestroy(): void {
    if (this.registeredId === null) return;
    const id = this.registeredId;
    this.returnFocus(id, { allowBody: false });
    // The `@if` view is destroyed before its bindings refresh (Angular 22.1.2), so the
    // `attr.inert` binding never marks a leaving panel; write it here.
    this.renderer.setAttribute(this.host.nativeElement, 'inert', '');
    this.registry.unregisterPanel(this.host.nativeElement);
  }
}
