import { CONTENT_MANIFEST } from './content.manifest';
import type { ContentPage } from './content.types';
import type {
  NavRootEntry,
  NavSection,
} from '../layout/sidebar-navigation/sidebar-navigation.types';

const pagesBySlug = new Map<string, ContentPage>(
  CONTENT_MANIFEST.pages.map((page) => [page.slug, page]),
);

/** Visible pages of one tree group, in tree order. */
const visiblePages = (slugs: readonly string[]): ContentPage[] =>
  slugs.flatMap((slug) => {
    const page = pagesBySlug.get(slug);
    return page && !page.hidden ? [page] : [];
  });

/** The unlabelled docs-root group — rendered above the first section label. */
const rootGroup = CONTENT_MANIFEST.tree.find((group) => group.label === null);

/** The docs root (`/overview`), or `null` when the tree has no unlabelled group. */
export const DOCS_NAV_ROOT: NavRootEntry | null =
  (rootGroup && visiblePages(rootGroup.entries)[0]) || null;

/** Labelled sidebar groups built from the manifest tree; hidden pages and empty groups drop out. */
export const DOCS_NAV_SECTIONS: readonly NavSection[] = CONTENT_MANIFEST.tree.flatMap((group) => {
  if (group.label === null) return [];
  const entries = visiblePages(group.entries).map(({ label, slug }) => ({ label, slug }));
  return entries.length > 0 ? [{ heading: group.label, entries }] : [];
});
