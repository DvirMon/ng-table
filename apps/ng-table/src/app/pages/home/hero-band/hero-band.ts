import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PillButton } from '../../../design-system/pill-button/pill-button';
import type { HeroBandAnnouncementStatus } from './hero-band.types';

/**
 * Home page's full-bleed accent-surface hero band. Page-local (`pages/home/docs/spec.md`
 * § "Hero — full-bleed accent band") — not a design-system component, not in the manifest.
 *
 * Owns the announcement pill, H1, lede, two on-band CTAs and the decorative shape. No copy is
 * hardcoded — everything textual comes in via inputs, authored by Wave 3's home-composition.
 * Navbar is a sibling in home.html, not projected here — negative margin-top pulls this band up
 * underneath it so it still visually reads as part of the band (see hero-band.css).
 */
@Component({
  selector: 'ngpt-home-hero-band',
  imports: [PillButton],
  templateUrl: './hero-band.html',
  styleUrl: './hero-band.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeHeroBand {
  readonly announcement = input<string>();
  readonly announcementStatus = input<HeroBandAnnouncementStatus>('success');
  readonly h1 = input<string>();
  readonly lede = input<string>();
  readonly primaryLabel = input<string>();
  readonly secondaryLabel = input<string>();

  /**
   * Primary/secondary CTA clicks. pill-button only ever renders a `<button>` (fixed contract),
   * so real `<a>` navigation can't live inside it — the consumer owns routing/href in its own
   * click handler. See docs/decisions.md "Buttons: string + output, not href objects".
   */
  readonly primaryClick = output<void>();
  readonly secondaryClick = output<void>();

  protected onPrimaryClick(): void {
    this.primaryClick.emit();
  }

  protected onSecondaryClick(): void {
    this.secondaryClick.emit();
  }
}
