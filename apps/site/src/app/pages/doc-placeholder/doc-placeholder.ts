import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { SidebarNavigation } from '../../layout/sidebar-navigation/sidebar-navigation';
import {
  DOCS_NAV_ROOT,
  DOCS_NAV_SECTIONS,
} from '../../layout/sidebar-navigation/sidebar-navigation.mock';
import { TocColumn } from '../../layout/toc-column/toc-column';
import type { PageState } from '../../content/page-state.types';

/**
 * Stand-in for the real Doc Article / Section Landing archetypes (`docs/design-handoff/specs/pages/`,
 * not built this round — `CONTEXT.md`). Exists only so every sidebar/navbar link resolves to a route
 * instead of a 404, matching any `/overview` or `/<section>/<entry>` slug from the nav tree.
 */
@Component({
  selector: 'ngpt-doc-placeholder',
  templateUrl: './doc-placeholder.html',
  styleUrl: './doc-placeholder.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SidebarNavigation, TocColumn],
})
export class DocPlaceholder {
  private readonly route = inject(ActivatedRoute);

  private readonly data = toSignal(this.route.data, { initialValue: this.route.snapshot.data });

  private readonly pageState = computed(() => this.data()['pageState'] as PageState);

  protected readonly root = DOCS_NAV_ROOT;
  protected readonly sections = DOCS_NAV_SECTIONS;
  protected readonly activeSlug = computed(() => this.pageState().entry?.slug ?? '');

  protected readonly label = computed(() => this.pageState().h1);
}
