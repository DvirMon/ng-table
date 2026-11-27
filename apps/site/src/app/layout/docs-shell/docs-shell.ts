import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DOCS_NAV_ROOT, DOCS_NAV_SECTIONS } from '../../content/nav-tree';
import type { PageState } from '../../content/page-state.types';
import { Pagination } from '../../design-system/pagination/pagination';
import { PaginationLink } from '../../design-system/pagination/pagination-link';
import { SearchStore } from '../../design-system/search/search.store';
import { Navbar } from '../navbar/navbar';
import { SidebarNavigation } from '../sidebar-navigation/sidebar-navigation';
import { TocColumn } from '../toc-column/toc-column';

/**
 * The docs page shell: `docs` navbar, then the 3-column grid (sidebar / content / TOC)
 * (`specs/layout/Page Structure Overview.md`). Every docs archetype projects its body into the
 * content column; sidebar, TOC and prev/next all read `pageState`, so no archetype wires them.
 */
@Component({
  selector: 'ngpt-docs-shell',
  templateUrl: './docs-shell.html',
  styleUrl: './docs-shell.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Navbar, SidebarNavigation, TocColumn, Pagination, PaginationLink, RouterLink],
})
export class DocsShell {
  protected readonly search = inject(SearchStore);

  readonly pageState = input.required<PageState>();

  protected readonly navRoot = DOCS_NAV_ROOT;
  protected readonly navSections = DOCS_NAV_SECTIONS;
  protected readonly activeSlug = computed(() => this.pageState().entry?.slug ?? null);
}
