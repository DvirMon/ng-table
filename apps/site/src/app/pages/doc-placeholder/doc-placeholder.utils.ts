import type {
  NavRootEntry,
  NavSection,
} from '../../layout/sidebar-navigation/sidebar-navigation.types';

/** Flattens root + sections and returns the entry/root label matching `slug`, or `null` if none match. */
export function findNavLabel(
  slug: string,
  root: NavRootEntry,
  sections: readonly NavSection[],
): string | null {
  if (root.slug === slug) {
    return root.label;
  }

  for (const section of sections) {
    const match = section.entries.find((entry) => entry.slug === slug);
    if (match) {
      return match.label;
    }
  }

  return null;
}
