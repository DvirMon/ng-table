import type { FooterLink } from '../../layout/page-footer/page-footer.types';
import type { FeatureCell } from './feature-grid/feature-grid.types';
import type { HeroBandAnnouncementStatus } from './hero-band/hero-band.types';

export interface HomeHeroContent {
  readonly announcement: string;
  readonly announcementStatus: HeroBandAnnouncementStatus;
  readonly h1: string;
  readonly lede: string;
  readonly primaryLabel: string;
  readonly secondaryLabel: string;
}

/** Shared eyebrow + H2 shape every section-rhythm block opens with (`docs/spec.md` § Section rhythm). */
export interface HomeSectionContent {
  readonly eyebrow: string;
  readonly heading: string;
}

export interface HomeFeaturesContent extends HomeSectionContent {
  readonly cells: readonly FeatureCell[];
}

export interface HomeInstallContent extends HomeSectionContent {
  readonly description: string;
  readonly command: string;
}

export interface HomeContent {
  readonly hero: HomeHeroContent;
  readonly features: HomeFeaturesContent;
  readonly install: HomeInstallContent;
  readonly footerLinks: readonly FooterLink[];
  readonly footerCopyright: string;
}
