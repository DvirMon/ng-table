import { Component, input, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { catchError, forkJoin, map, of, tap, type Observable } from 'rxjs';
import { createTable } from '../../api/create-table';
import { beginEdit, clearEdit, endEdit } from '../../mutations/row-edit-mutations';
import { patchRow } from '../../mutations/row-mutations';
import {
  discardEdit,
  releaseEdit,
  revertEdit,
  swapRowId,
} from '../../mutations/optimistic-mutations';
import { NgpTableRowFieldDirective } from '../../directives/ngp-table-row-field.directive';
import type { RowId } from '../../api/types';
import { DEPT_OPTIONS, EDIT_ROWS_MOCK } from '../row-edit.mock';
import { editRowsSchema, gatedTableSchema } from '../row-edit.schema';
import { injectRowEditApi } from '../row-edit.http';
import { containFocusTab } from '../row-edit.utils';
import type { EditRow } from '../row-edit.types';

/**
 * S4 — the gated table (`withRowEdit()`), fixed to single-row + optimistic save: `endEdit`
 * merges the draft and closes the row immediately, then a real MSW-intercepted `fetch`
 * reconciles it (`releaseEdit` on success, `revertEdit` on failure). `multiple` is left
 * unconfigured — `gatedTableSchema()` defaults to single-row (D14). See `../gated-single-pessimistic/`
 * for the same single-row surface with a pessimistic (wait-for-the-round-trip) save, and
 * `../gated-multiple-optimistic/` for this same save path with several rows open at once.
 *
 * A row added via `addBlankRow`/`duplicateRow` (tracked in `pendingCreateIds`) saves through a
 * `POST` instead of `PUT` — the mock server assigns its own id. `endEdit` already closed the row
 * before the request went out, so by the time the response lands the row is `pending`, not
 * `open`: `swapRowId(tempId, saved.id)` re-keys `snapshots` so the restore point doesn't orphan
 * under the dead temp id (bug 1 of D49/G3 — "a pending create settled under the server id
 * silently no-ops"). See `../gated-single-pessimistic/` for the sibling bug — a row still `open`
 * (not yet closed) when the swap lands. Known limitation this does **not** fix: Angular's
 * `@for (...; track row.id)` still recreates the `<tr>` when its tracked id changes, which can
 * take focus with it (G9, `docs/3-ui/work/row-editing/5-gaps.md`) — a UI-layer gap, not a state
 * one. `discardRow` deletes through the server too, unless the row was never saved
 * (`pendingCreateIds`), in which case there's nothing server-side to delete.
 */
@Component({
  selector: 'ngp-gated-single-optimistic-story-host',
  imports: [FormField, NgpTableRowFieldDirective],
  templateUrl: './gated-single-optimistic-story-host.component.html',
  styleUrl: '../row-edit-story.css',
})
export class GatedSingleOptimisticStoryHostComponent {
  readonly forceFailure = input(false);
  readonly latencyMs = input(600);

  private readonly rowEditApi = injectRowEditApi();

  protected readonly data = signal<EditRow[]>(EDIT_ROWS_MOCK);
  protected readonly table = createTable(this.data, gatedTableSchema());
  /** Gated mode's commit boundary is the row (OQ-3) — `form()` writes into `table.draft` instead
   * of `data`, so a field's blur-commit can't move the row under the user or leak into the
   * pipeline before Save (`withRowEdit()`'s `draft` member, `api/features/draft-rows.ts`). */
  protected readonly rows = form(this.table.draft, editRowsSchema);
  protected readonly deptOptions = DEPT_OPTIONS;
  protected readonly insertAt = signal(0);
  protected readonly saveAllSummary = signal<string | null>(null);

  /** id -> a save failure's message, persistent until dismissed or retried (§1.4) — unlike the
   * old single `saveError` signal, this doesn't clear itself on an unrelated action, and it's
   * keyed per row so `saveAll()` can report which rows failed. */
  protected readonly rowErrors = signal<ReadonlyMap<RowId, string>>(new Map());

  /** Row ids a "Force invalid" toggle has marked — disables Save and shows the reason at the
   * cell (§1.7), independent of the form's own validity. */
  protected readonly forcedInvalid = signal<ReadonlySet<RowId>>(new Set());

  /** Row ids whose `name` was copied verbatim from a duplicate's source — flagged so the UI can
   * visibly mark the field as needing a change rather than silently copying a collision
   * (`0-product/row-editing.md` §4.1). Cleared once the row leaves editing, whatever the exit. */
  protected readonly needsUniqueName = signal<ReadonlySet<RowId>>(new Set());

  /** Ids added this session that have never reached the server — `saveEdit` uses this to decide
   * `POST` (create) vs `PUT` (update). Cleared per-id once its create succeeds (`swapRowId`
   * follows); left set on a failed create so retry still posts. */
  protected readonly pendingCreateIds = signal<ReadonlySet<RowId>>(new Set());

  /** One add path (D36/D42): `beginEdit({ insert })` opens the row with a real-value snapshot,
   * same as `beginEdit` on an existing row. Discard-vs-reset is no longer chosen here — it's a
   * Cancel choice available on any open row, not something tied to how the row was added. */
  protected addBlankRow(): void {
    const id = crypto.randomUUID();
    this.table.editing.update(
      beginEdit(id, {
        insert: { id, name: '', dept: DEPT_OPTIONS[0] },
        at: this.insertAt(),
      }),
    );
    this.markPendingCreate(id);
  }

  /** Duplicates `sourceId`'s row directly below itself and opens the copy — `beginEdit({ insert })`
   * (D42), the same call `addBlankRow()` uses, just seeded from an existing row instead of blank
   * fields. No new library API (`1-design.md` §"Story this owes"). */
  protected duplicateRow(sourceId: RowId): void {
    const data = this.data();
    const sourceIndex = data.findIndex((row) => this.table.trackBy(row) === sourceId);
    if (sourceIndex === -1) return;

    const source = data[sourceIndex];
    const at = sourceIndex + 1;
    const id = crypto.randomUUID();
    this.table.editing.update(beginEdit(id, { insert: { ...source, id }, at }));
    // §4.1: `name` was copied verbatim from `source` — flag it as needing a change instead of
    // silently copying a collision.
    this.needsUniqueName.update((ids) => new Set(ids).add(id));
    this.markPendingCreate(id);
  }

  /**
   * D31.2: single-mode switches by discarding the displaced row's unsaved draft, cleanly — not a
   * Save. Whether to warn before that discard is a consumer decision the library doesn't own; this
   * demonstrates the pattern — check the outgoing row's own `dirty` state (Signal Forms already
   * tracks it) and confirm before calling `beginEdit`, which is the only thing that triggers the
   * switch.
   */
  protected openEdit(id: RowId): void {
    const displacedId = [...this.table.editing()].find((openId) => openId !== id);
    if (displacedId !== undefined && this.isRowDirty(displacedId)) {
      const discard = confirm('This row has unsaved changes. Discard them and switch rows?');
      if (!discard) return;
    }
    // beginEdit: opens the row; existing restore point wins if one is already held (D31.1).
    this.table.editing.update(beginEdit(id));
  }

  private isRowDirty(id: RowId): boolean {
    const sourceIndex = this.table.renderRows().find((row) => row.id === id)?.sourceIndex;
    return sourceIndex === undefined ? false : this.rows[sourceIndex]().dirty();
  }

  /** Resets the row to its snapshot and closes it. Available on any open row. */
  protected cancelEdit(id: RowId): void {
    this.table.editing.update(revertEdit(id));
    this.clearNeedsUniqueName(id);
    this.clearRowError(id);
  }

  /** Removes the row and closes it. Available on any open row, whether it pre-existed or was
   * just added: discarding an edit to an existing row removes it too, deliberately. A row never
   * saved to the server (`pendingCreateIds`) has nothing to delete remotely — `discardEdit`
   * alone is correct there. Anything else goes through a real `DELETE` first. */
  protected discardRow(id: RowId): void {
    this.clearRowError(id);

    if (this.pendingCreateIds().has(id)) {
      this.table.editing.update(discardEdit(id));
      this.clearNeedsUniqueName(id);
      this.removePendingCreate(id);
      return;
    }

    this.rowEditApi
      .deleteRow(id, { forceFailure: this.forceFailure(), latencyMs: this.latencyMs() })
      .subscribe({
        next: () => {
          this.table.editing.update(discardEdit(id));
          this.clearNeedsUniqueName(id);
        },
        error: (error: unknown) => {
          this.setRowError(id, error instanceof Error ? error.message : 'Delete failed.');
        },
      });
  }

  protected clearAll(): void {
    // clearEdit: closes every open row, dropping their restore points.
    this.table.editing.update(clearEdit());
    this.needsUniqueName.set(new Set());
    this.rowErrors.set(new Map());
    this.pendingCreateIds.set(new Set());
  }

  /** §1.7: per-row toggle that blocks Save independent of form validity — "Force invalid". */
  protected toggleForceInvalid(id: RowId): void {
    this.forcedInvalid.update((ids) => {
      const next = new Set(ids);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  /** §1.6 keyboard: Escape cancels the open row, Enter saves it, Tab stays inside the row's
   * cells. Bound on the row's `<tr>` (`event.currentTarget`), which doubles as the Tab-contain
   * boundary. */
  protected onRowKeydown(event: KeyboardEvent, id: RowId): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelEdit(id);
      return;
    }
    if (event.key === 'Enter' && !(event.target instanceof HTMLTextAreaElement)) {
      event.preventDefault();
      this.saveEdit(id);
      return;
    }
    if (event.key === 'Tab') {
      containFocusTab(event, event.currentTarget as HTMLElement);
    }
  }

  /** Optimistic save (S4): merges the draft into `data` and closes the row immediately
   * (`endEdit(id, row)`), moving it to `pending`, then rolls back on a failed save or settles it
   * on success. A real MSW-intercepted `HttpClient` request, not a Promise stub —
   * `forceFailure`/`latencyMs` are Storybook-controlled request headers the handler reads
   * (`row-edit.handlers.ts`). A `pendingCreateIds` row `POST`s instead of `PUT`s; on success the
   * server's id lands via `patchRow` + `swapRowId(id, saved.id)` instead of a plain
   * `releaseEdit` — see the class doc-comment for what that does and doesn't fix. */
  protected saveEdit(id: RowId): void {
    this.saveEdit$(id).subscribe();
  }

  /** Re-runs the save that just failed (§1.4's Retry). An optimistic failure always closes and
   * reverts the row first, so retry always reopens it via `beginEdit` before saving again — not a
   * mode branch, just this save path's shape. */
  protected retrySave(id: RowId): void {
    if (!this.table.editing().has(id)) {
      this.table.editing.update(beginEdit(id));
    }
    this.saveEdit(id);
  }

  protected dismissError(id: RowId): void {
    this.clearRowError(id);
  }

  /** §1.8 save-all: reuses `saveEdit$` per open row rather than inventing a batched verb — the
   * library has none for this. `forkJoin` subscribes to every row's save Observable up front and
   * completes once all of them have (each internally catches its own failure, so one row failing
   * never short-circuits the others). Only rows that actually saved end up closed; a failed save
   * closes and reverts its row anyway (inherent to closing before the round trip settles, not a
   * save-all-specific limitation). */
  protected saveAll(): void {
    this.saveAllSummary.set(null);
    const openIds = Array.from(this.table.editing());
    if (openIds.length === 0) {
      this.saveAllSummary.set('No open rows to save.');
      return;
    }

    forkJoin(openIds.map((id) => this.saveEdit$(id))).subscribe(() => {
      const failedIds = openIds.filter((id) => this.rowErrors().has(id));
      const succeededCount = openIds.length - failedIds.length;
      this.saveAllSummary.set(
        failedIds.length === 0
          ? `Saved all ${succeededCount} row(s).`
          : `Saved ${succeededCount} of ${openIds.length} row(s); ${failedIds.length} failed.`,
      );
    });
  }

  /** §2.3 "add several in a run": saves the open row, then — only once it actually saved —
   * opens a fresh blank row via the same `beginEdit({ insert, at })` path `addBlankRow()` uses. */
  protected saveAndAddNext(id: RowId): void {
    this.saveEdit$(id).subscribe(() => {
      if (this.rowErrors().has(id)) {
        return;
      }
      this.addBlankRow();
    });
  }

  /** Returns an `Observable<void>` (not a fire-and-forget `.subscribe()`) so `saveAll`/
   * `saveAndAddNext` can compose completion via `forkJoin`/`.subscribe()` themselves. */
  private saveEdit$(id: RowId): Observable<void> {
    this.clearRowError(id);
    if (this.forcedInvalid().has(id)) {
      this.setRowError(id, 'Row is marked invalid — clear "Force invalid" before saving.');
      return of(undefined);
    }

    const row = this.table.draft().find((candidate) => this.table.trackBy(candidate) === id);
    if (row === undefined) {
      return of(undefined);
    }
    // endEdit(id, row): merges the draft and closes the row immediately, together — it shows as
    // `pending` (restore point kept, D41) until the request below resolves it.
    this.table.editing.update(endEdit(id, row));
    const isCreate = this.pendingCreateIds().has(id);

    return this.rowEditApi
      .saveRow(id, row, isCreate, { forceFailure: this.forceFailure(), latencyMs: this.latencyMs() })
      .pipe(
        tap((saved) => {
          if (isCreate) {
            // patchRow lands the server's identity in `data`; swapRowId re-keys
            // `open`/`snapshots` to match, synchronously, before ADR-0006's reconciliation
            // effect can flush (D49). releaseEdit under the new id then drops the
            // now-correctly-keyed restore point — without it the row would sit in `pending`
            // forever (the exact bug G3 closes).
            this.table.value.update(patchRow<EditRow>(id, saved));
            this.table.editing.update(swapRowId<EditRow>(id, saved.id));
            this.table.editing.update(releaseEdit<EditRow>(saved.id));
            this.removePendingCreate(id);
          } else {
            // releaseEdit: save confirmed — drops the held restore point, row is no longer pending.
            this.table.editing.update(releaseEdit(id));
          }
          this.clearNeedsUniqueName(id);
        }),
        map(() => undefined),
        catchError((error: unknown) => {
          this.setRowError(id, error instanceof Error ? error.message : 'Save failed.');
          // revertEdit: save failed — restores the pre-edit snapshot and closes the row.
          this.table.editing.update(revertEdit(id));
          return of(undefined);
        }),
      );
  }

  private markPendingCreate(id: RowId): void {
    this.pendingCreateIds.update((ids) => new Set(ids).add(id));
  }

  private removePendingCreate(id: RowId): void {
    if (!this.pendingCreateIds().has(id)) return;
    this.pendingCreateIds.update((ids) => {
      const next = new Set(ids);
      next.delete(id);
      return next;
    });
  }

  /** Drops `id`'s duplicate flag once its row leaves editing, whatever the exit path. */
  private clearNeedsUniqueName(id: RowId): void {
    if (!this.needsUniqueName().has(id)) return;
    this.needsUniqueName.update((ids) => {
      const next = new Set(ids);
      next.delete(id);
      return next;
    });
  }

  private setRowError(id: RowId, message: string): void {
    this.rowErrors.update((errors) => new Map(errors).set(id, message));
  }

  private clearRowError(id: RowId): void {
    if (!this.rowErrors().has(id)) return;
    this.rowErrors.update((errors) => {
      const next = new Map(errors);
      next.delete(id);
      return next;
    });
  }
}
