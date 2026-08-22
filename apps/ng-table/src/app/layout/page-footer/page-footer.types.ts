/** One entry in `ngpt-page-footer`'s optional link row (Home's Sponsor / Discord / GitHub row). */
export interface FooterLink {
  readonly label: string;
  readonly href: string;
  readonly external?: boolean;
}
