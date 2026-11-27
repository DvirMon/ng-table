import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NavItem } from '../../design-system/nav-item/nav-item';
import type { NavRootEntry, NavSection } from './sidebar-navigation.types';

/**
 * `role="navigation"` landmark — the docs sidebar. Renders the nav tree it is given as real
 * `<a ngptNavItem>` rows. The tree is built from the content manifest (`content/nav-tree.ts`);
 * `activeSlug` is caller-supplied from `PageState`.
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
  /** The docs root item above the first section label; `null` renders none. */
  readonly root = input.required<NavRootEntry | null>();
  readonly sections = input.required<readonly NavSection[]>();
  readonly activeSlug = input<string | null>(null);
}
