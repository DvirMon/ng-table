import type { Signal } from '@angular/core';
import { httpResource, HttpErrorResponse, HttpHeaders, type HttpResourceRef } from '@angular/common/http';
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

function isDealPagePayload(value: unknown): value is DealPagePayload {
  return typeof value === 'object' && value !== null && 'rows' in value && 'total' in value;
}

/** `httpResource`'s `parse` always hands back `unknown` — MSW owns the response shape, so a
 * mismatch here means the fixture drifted from `handlers.ts` and surfaces via the resource's own
 * error channel rather than a silent bad read. */
function toDealPage(payload: unknown): DealPage {
  if (!isDealPagePayload(payload)) {
    throw new Error('Unexpected grouped-rows response shape.');
  }
  return { rows: payload.rows.map(toDealRow), total: payload.total };
}

function headersFor(options: GroupedRowsRequestOptions): HttpHeaders {
  return new HttpHeaders({
    'X-Force-Failure': String(options.forceFailure),
    'X-Latency-Ms': String(options.latencyMs),
  });
}

/**
 * `httpResource()` read for the grouping rows page — headers carry the Storybook
 * `forceFailure`/`latencyMs` controls `handlers.ts` (MSW) reads. `options` returning `undefined`
 * keeps the resource idle (no request).
 */
export function createGroupedRowsResource(
  options: () => GroupedRowsRequestOptions | undefined
): HttpResourceRef<DealPage | undefined> {
  return httpResource(
    () => {
      const requestOptions = options();
      return requestOptions && { url: '/api/grouped-rows', headers: headersFor(requestOptions) };
    },
    { parse: toDealPage }
  );
}

/**
 * `httpResource()` read for the async grouping-rule lookup, driven by `params` rather than an
 * inline closure — `GroupingAsyncRule.factory` hands us the rule's own params signal.
 */
export function createGroupingPreferenceResource(
  params: Signal<GroupedRowsRequestOptions | undefined>
): HttpResourceRef<GroupingPreference | undefined> {
  return httpResource<GroupingPreference>(() => {
    const requestOptions = params();
    return requestOptions && { url: '/api/grouping-preference', headers: headersFor(requestOptions) };
  });
}

/** Normalizes an `httpResource` error into display text — the MSW `message` body when present,
 * `fallback` otherwise. */
export function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    const body: unknown = error.error;
    const message = isMessageBody(body) ? body.message : undefined;
    return message ?? fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

function isMessageBody(body: unknown): body is { message: string } {
  return (
    typeof body === 'object' &&
    body !== null &&
    'message' in body &&
    typeof body.message === 'string'
  );
}
