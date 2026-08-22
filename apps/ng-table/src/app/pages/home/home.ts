import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Wave 0 placeholder — kept minimal so the app compiles for every wave.
 * Replaced by the Wave 3 home-composition agent per docs/spec.md.
 */
@Component({
  selector: 'ngpt-home',
  templateUrl: './home.html',
  styleUrl: './home.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {}
