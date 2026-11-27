import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import type { PageState } from '../../content/page-state.types';
import { DocsShell } from '../../layout/docs-shell/docs-shell';

/**
 * Stand-in for the real Doc Article / Section Landing archetypes (`docs/design-handoff/specs/pages/`,
 * not built this round — `CONTEXT.md`). Renders the docs shell around a bare H1 so every manifest
 * route resolves to a page with live sidebar, TOC and pagination.
 */
@Component({
  selector: 'ngpt-doc-placeholder',
  templateUrl: './doc-placeholder.html',
  styleUrl: './doc-placeholder.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DocsShell],
})
export class DocPlaceholder {
  private readonly route = inject(ActivatedRoute);

  private readonly data = toSignal(this.route.data, { initialValue: this.route.snapshot.data });

  protected readonly pageState = computed(() => this.data()['pageState'] as PageState);
}
