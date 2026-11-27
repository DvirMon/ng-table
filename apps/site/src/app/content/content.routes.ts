import type { Route } from '@angular/router';
import { CONTENT_MANIFEST } from './content.manifest';
import { pageStateResolver, pageTitleResolver } from './page-state';

/** One route per manifest page, hidden pages included — they stay routable. */
export const contentRoutes: Route[] = CONTENT_MANIFEST.pages.map((page) => ({
  path: page.slug.slice(1),
  title: pageTitleResolver,
  resolve: { pageState: pageStateResolver },
  loadComponent: () =>
    import('../pages/doc-placeholder/doc-placeholder').then((m) => m.DocPlaceholder),
}));
