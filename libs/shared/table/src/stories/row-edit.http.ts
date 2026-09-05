import { inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { catchError, throwError, type Observable } from 'rxjs';
import type { RowId } from '../api/types';
import type { EditRow } from './row-edit.types';

export interface RowEditRequestOptions {
  readonly forceFailure: boolean;
  readonly latencyMs: number;
}

export interface RowEditApi {
  readonly saveRow: (id: RowId, row: EditRow, isCreate: boolean, options: RowEditRequestOptions) => Observable<EditRow>;
  readonly deleteRow: (id: RowId, options: RowEditRequestOptions) => Observable<void>;
}

/** HttpClient wrapper for the row-edit stories' save/delete round trips — headers carry the
 * Storybook forceFailure/latencyMs controls that `row-edit.handlers.ts` (MSW) reads. Non-2xx and
 * network errors both normalize to the same `Error(message)` shape the five hosts' `error`
 * callbacks already expect. */
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

  return { saveRow, deleteRow };
}

function normalizeError(error: unknown, fallback: string): Error {
  if (error instanceof HttpErrorResponse) {
    const message = (error.error as { message?: string } | null)?.message;
    return new Error(message ?? fallback);
  }
  return error instanceof Error ? error : new Error(fallback);
}
