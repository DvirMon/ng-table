import { inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { catchError, map, throwError, type Observable } from 'rxjs';
import type { RowId } from '../../../api/types';
import type { EditRow } from './types';

export interface RowEditRequestOptions {
  readonly forceFailure: boolean;
  readonly latencyMs: number;
}

export interface RowEditApi {
  readonly saveRow: (id: RowId, row: EditRow, isCreate: boolean, options: RowEditRequestOptions) => Observable<EditRow>;
  readonly deleteRow: (id: RowId, options: RowEditRequestOptions) => Observable<void>;
  /** One request for every row in `rows` — a batch failure fails the whole array, never some of
   * it. Used only by `../gated-bulk-optimistic/`. */
  readonly saveBulk: (rows: EditRow[], options: RowEditRequestOptions) => Observable<EditRow[]>;
}

/** HttpClient wrapper for the row-edit stories' save/delete round trips — headers carry the
 * Storybook forceFailure/latencyMs controls that `row-edit.handlers.ts` (MSW) reads. Non-2xx and
 * network errors both normalize to the same `Error(message)` shape the hosts' `error` callbacks
 * already expect. */
export function injectRowEditApi(): RowEditApi {
  const http = inject(HttpClient);

  function headersFor(options: RowEditRequestOptions): HttpHeaders {
    return new HttpHeaders({
      'X-Force-Failure': String(options.forceFailure),
      'X-Latency-Ms': String(options.latencyMs),
    });
  }

  function saveRow(
    id: RowId,
    row: EditRow,
    isCreate: boolean,
    options: RowEditRequestOptions,
  ): Observable<EditRow> {
    const headers = headersFor(options);
    const request$ = isCreate
      ? http.post<EditRow>('/api/rows', row, { headers })
      : http.put<EditRow>(`/api/rows/${id}`, row, { headers });
    return request$.pipe(catchError((error: unknown) => throwError(() => normalizeError(error, 'Save failed.'))));
  }

  function deleteRow(id: RowId, options: RowEditRequestOptions): Observable<void> {
    const headers = headersFor(options);
    return http
      .delete<void>(`/api/rows/${id}`, { headers })
      .pipe(catchError((error: unknown) => throwError(() => normalizeError(error, 'Delete failed.'))));
  }

  function saveBulk(rows: EditRow[], options: RowEditRequestOptions): Observable<EditRow[]> {
    const headers = headersFor(options);
    return http.post<{ rows: EditRow[] }>('/api/rows/bulk', { rows }, { headers }).pipe(
      map((response) => response.rows),
      catchError((error: unknown) => throwError(() => normalizeError(error, 'Batch save failed.'))),
    );
  }

  return { saveRow, deleteRow, saveBulk };
}

function normalizeError(error: unknown, fallback: string): Error {
  if (error instanceof HttpErrorResponse) {
    const message = (error.error as { message?: string } | null)?.message;
    return new Error(message ?? fallback);
  }
  return error instanceof Error ? error : new Error(fallback);
}
