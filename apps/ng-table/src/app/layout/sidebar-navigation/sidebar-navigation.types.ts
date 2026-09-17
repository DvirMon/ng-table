export interface NavEntry {
  label: string;
  slug: string;
  hidden?: boolean;
}

export interface NavSection {
  heading: string;
  entries: readonly NavEntry[];
}

export interface NavRootEntry {
  label: string;
  slug: string;
}
