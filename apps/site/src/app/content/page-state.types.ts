import type { ContentArchetype, ContentHeading, ContentPage } from './content.types';

/** `Not Found` is not a manifest archetype — it is what an unmatched path resolves to. */
export type PageArchetype = ContentArchetype | 'Not Found';

/** What every docs surface reads for one URL — `Routing and Page State.md` § Page state. */
export interface PageState {
  readonly archetype: PageArchetype;
  /** The matched manifest page, or `null` when the path is unmatched. */
  readonly entry: ContentPage | null;
  /** Parent section label; `null` for the root entry and for unmatched paths. */
  readonly section: string | null;
  /** Category badge text; `null` renders nothing. */
  readonly eyebrow: string | null;
  /** Always `entry.label`, so it never differs from the nav item. */
  readonly h1: string;
  readonly prev: ContentPage | null;
  readonly next: ContentPage | null;
  readonly headings: readonly ContentHeading[];
  /** Document title. */
  readonly title: string;
}
