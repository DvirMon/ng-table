import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, map, throwError, type Observable } from 'rxjs';
import type {
  InvoicePage,
  InvoicePagePayload,
  InvoiceRow,
  InvoiceRowPayload,
} from './types';

export interface InvoiceRequestOptions {
  readonly forceFailure: boolean;
  readonly latencyMs: number;
}

export interface InvoiceApi {
  /** `params` is built by the host, not here — the query mapping is the shipped DX and the
   * server story shows it rather than hiding it behind a helper. */
  readonly fetchInvoices: (
    params: Record<string, string>,
    options: InvoiceRequestOptions,
  ) => Observable<InvoicePage>;
}

/** JSON has no `Date`, so `issuedAt` arrives as a string and is revived here — a host never
 * holds a `Date`-typed field that is really a string. */
function reviveInvoiceRow(payload: InvoiceRowPayload): InvoiceRow {
  return { ...payload, issuedAt: new Date(payload.issuedAt) };
}

function normalizeError(error: unknown, fallback: string): Error {
  if (error instanceof HttpErrorResponse) {
    const body: unknown = error.error;
    const message =
      typeof body === 'object' && body !== null && 'message' in body ? body.message : undefined;
    return new Error(typeof message === 'string' ? message : fallback);
  }
  return error instanceof Error ? error : new Error(fallback);
}

/** `HttpClient` wrapper for `GET /api/invoices` — Observable-based, matching the repo's only
 * other transport precedent (`row-edit/fixtures/http.ts`). The headers carry the Storybook
 * `forceFailure`/`latencyMs` controls that `handlers.ts` reads. */
export function injectInvoiceApi(): InvoiceApi {
  const http = inject(HttpClient);

  function fetchInvoices(
    params: Record<string, string>,
    options: InvoiceRequestOptions,
  ): Observable<InvoicePage> {
    const headers = new HttpHeaders({
      'X-Force-Failure': String(options.forceFailure),
      'X-Latency-Ms': String(options.latencyMs),
    });

    return http
      .get<InvoicePagePayload>('/api/invoices', {
        headers,
        params: new HttpParams({ fromObject: params }),
      })
      .pipe(
        map((page): InvoicePage => ({ rows: page.rows.map(reviveInvoiceRow), total: page.total })),
        catchError((error: unknown) =>
          throwError(() => normalizeError(error, 'Loading invoices failed.')),
        ),
      );
  }

  return { fetchInvoices };
}
