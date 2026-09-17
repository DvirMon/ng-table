/**
 * One entry in the footer's optional link row (Home's Sponsor / Discord / GitHub row). Not an
 * input any more — the consumer authors the `<a ngptPageFooterLink>` elements — but kept as the
 * typed shape `pages/home/home.content.ts` uses for that authored copy.
 */
export interface FooterLink {
  readonly label: string;
  readonly href: string;
  readonly external?: boolean;
}
