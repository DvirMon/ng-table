import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'ngpt-category-badge',
  templateUrl: './category-badge.html',
  styleUrl: './category-badge.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryBadge {}
