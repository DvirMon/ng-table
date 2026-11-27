import { Route } from '@angular/router';
import { contentRoutes } from './content/content.routes';
import { pageStateResolver, pageTitleResolver } from './content/page-state';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home').then((m) => m.Home),
  },
  ...contentRoutes,
  {
    path: '**',
    title: pageTitleResolver,
    resolve: { pageState: pageStateResolver },
    loadComponent: () => import('./pages/not-found/not-found').then((m) => m.NotFound),
  },
];
