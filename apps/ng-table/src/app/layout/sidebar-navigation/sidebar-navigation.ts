import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NavItem } from '../../design-system/nav-item/nav-item';
import { DOCS_NAV_ROOT, DOCS_NAV_SECTIONS } from './sidebar-navigation.mock';
import type { NavRootEntry, NavSection } from './sidebar-navigation.types';

/**
 * `role="navigation"` landmark — the docs sidebar. Renders the nav tree
 * (`docs/design-handoff/specs/Content Model.md`) as real `<a ngptNavItem>` rows; no router
 * wiring yet (`activeSlug` is caller-supplied, matching `navbar`'s plain-`href` convention).
 */
@Component({
  selector: 'ngpt-sidebar-navigation',
  templateUrl: './sidebar-navigation.html',
  styleUrl: './sidebar-navigation.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NavItem, RouterLink],
  host: {
    role: 'navigation',
    'aria-label': 'Docs',
  },
})
export class SidebarNavigation {
  readonly root = input<NavRootEntry>(DOCS_NAV_ROOT);
  readonly sections = input<readonly NavSection[]>(DOCS_NAV_SECTIONS);
  readonly activeSlug = input<string | null>(null);

  /** Drops `hidden` entries, then drops any section left with none — no empty label/group renders. */
  protected readonly visibleSections = computed(() =>
    this.sections()
      .map((section) => ({
        ...section,
        entries: section.entries.filter((entry) => !entry.hidden),
      }))
      .filter((section) => section.entries.length > 0),
  );
}
