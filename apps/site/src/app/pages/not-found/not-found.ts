import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { PageState } from '../../content/page-state.types';

/** Unmatched-path page (`Routing and Page State.md` § Resolution, row 3). */
@Component({
  selector: 'ngpt-not-found',
  templateUrl: './not-found.html',
  styleUrl: './not-found.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
})
export class NotFound {
  private readonly data = toSignal(inject(ActivatedRoute).data);

  protected readonly h1 = computed(() => (this.data()?.['pageState'] as PageState).h1);
}
