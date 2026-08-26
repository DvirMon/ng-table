import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { SidebarNavigation } from '../../layout/sidebar-navigation/sidebar-navigation';
import { DOCS_NAV_ROOT, DOCS_NAV_SECTIONS } from '../../layout/sidebar-navigation/sidebar-navigation.mock';
import { TocColumn } from '../../layout/toc-column/toc-column';
import { findNavLabel } from './doc-placeholder.utils';

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

  private readonly slug = toSignal(
    this.route.url.pipe(map((segments) => '/' + segments.map((segment) => segment.path).join('/'))),
    { initialValue: '/' + this.route.snapshot.url.map((segment) => segment.path).join('/') },
  );

  protected readonly root = DOCS_NAV_ROOT;
  protected readonly sections = DOCS_NAV_SECTIONS;
  protected readonly activeSlug = this.slug;

  protected readonly label = computed(() => findNavLabel(this.slug(), this.root, this.sections) ?? this.slug());
}
