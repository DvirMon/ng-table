import { InjectionToken } from '@angular/core';

import type { NgpTableDirective } from './ngp-table.directive';
import type { NgpTableRowDirective } from './ngp-table-row.directive';

export const NGP_TABLE_STORE = new InjectionToken<NgpTableDirective>('NGP_TABLE_STORE');
export const NGP_TABLE_ROW = new InjectionToken<NgpTableRowDirective>('NGP_TABLE_ROW');
