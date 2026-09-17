import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home').then((m) => m.Home),
  },
  {
    path: 'overview',
    loadComponent: () => import('./pages/doc-placeholder/doc-placeholder').then((m) => m.DocPlaceholder),
  },
  {
    path: ':section/:entry',
    loadComponent: () => import('./pages/doc-placeholder/doc-placeholder').then((m) => m.DocPlaceholder),
  },
];
