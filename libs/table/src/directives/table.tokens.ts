import { InjectionToken } from '@angular/core';

import type { NgpTableDirective } from './ngp-table.directive';
import type { NgpTableRowMoveDirective } from './ngp-table-row-move.directive';
import type { NgpTableRowDirective } from './ngp-table-row.directive';

// Injected type is erased to `unknown` — DI can't preserve a generic's actual `TRow` across
// injection.
export const NGP_TABLE_STORE = new InjectionToken<NgpTableDirective<unknown>>('NGP_TABLE_STORE');
export const NGP_TABLE_ROW = new InjectionToken<NgpTableRowDirective<unknown>>('NGP_TABLE_ROW');
export const NGP_TABLE_ROW_MOVE = new InjectionToken<NgpTableRowMoveDirective<unknown>>(
  'NGP_TABLE_ROW_MOVE',
);
