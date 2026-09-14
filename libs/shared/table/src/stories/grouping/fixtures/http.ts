import { inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { catchError, map, throwError, type Observable } from 'rxjs';
import type { DealPage, DealRow } from './types';

export interface GroupedRowsRequestOptions {
  readonly forceFailure: boolean;
  readonly latencyMs: number;
}

/** Whether `rep` is an active grouping level — the server's answer, awaited by the
 * `applyGroupingAsync()` rule in `grouping-static/`. */
export interface GroupingPreference {
  readonly groupByRep: boolean;
}

export interface GroupedRowsApi {
  readonly fetchRows: (options: GroupedRowsRequestOptions) => Observable<DealPage>;
  readonly fetchGroupingPreference: (
    options: GroupedRowsRequestOptions
  ) => Observable<GroupingPreference>;
}

/** `closedAt` crosses the wire as an ISO string. It has to come back a `Date` before the table
 * sees it: `toGroupKey` normalizes a `Date` to `date:<time>` and leaves a string as
 * `string:<iso>`, so skipping this would silently change every group id the `closedAt` level
 * produces between the seeded rows and a refetched set. */
interface DealRowPayload extends Omit<DealRow, 'closedAt' | 'children'> {
  readonly closedAt: string;
  readonly children?: DealRowPayload[];
}

interface DealPagePayload {
  readonly rows: DealRowPayload[];
  readonly total: number;
}

function toDealRow(payload: DealRowPayload): DealRow {
  const { closedAt, children, ...rest } = payload;
  const revivedChildren = children?.map(toDealRow);
  return {
    ...rest,
    closedAt: new Date(closedAt),
    ...(revivedChildren ? { children: revivedChildren } : {}),
  };
}

/**
 * `HttpClient` wrapper for the grouping stories' read-only round trips — headers carry the
 * Storybook `forceFailure`/`latencyMs` controls `handlers.ts` (MSW) reads. Non-2xx and network
 * errors normalize to one `Error(message)` shape, as `row-edit/fixtures/http.ts` does.
 */
export function injectGroupedRowsApi(): GroupedRowsApi {
  const http = inject(HttpClient);

  function headersFor(options: GroupedRowsRequestOptions): HttpHeaders {
    return new HttpHeaders({
      'X-Force-Failure': String(options.forceFailure),
      'X-Latency-Ms': String(options.latencyMs),
    });
  }

  function fetchRows(options: GroupedRowsRequestOptions): Observable<DealPage> {
    return http
      .get<DealPagePayload>('/api/grouped-rows', { headers: headersFor(options) })
      .pipe(
        map((page) => ({ rows: page.rows.map(toDealRow), total: page.total })),
        catchError((error: unknown) => throwError(() => normalizeError(error, 'Refresh failed.')))
      );
  }

  function fetchGroupingPreference(
    options: GroupedRowsRequestOptions
  ): Observable<GroupingPreference> {
    return http
      .get<GroupingPreference>('/api/grouping-preference', { headers: headersFor(options) })
      .pipe(
        catchError((error: unknown) =>
          throwError(() => normalizeError(error, 'Grouping preference lookup failed.'))
        )
      );
  }

  return { fetchRows, fetchGroupingPreference };
}

function normalizeError(error: unknown, fallback: string): Error {
  if (error instanceof HttpErrorResponse) {
    const body: unknown = error.error;
    const message = isMessageBody(body) ? body.message : undefined;
    return new Error(message ?? fallback);
  }
  return error instanceof Error ? error : new Error(fallback);
}

function isMessageBody(body: unknown): body is { message: string } {
  return (
    typeof body === 'object' &&
    body !== null &&
    'message' in body &&
    typeof body.message === 'string'
  );
}
