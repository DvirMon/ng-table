import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft, lucideArrowRight } from '@ng-icons/lucide';
import { PaginationEntry } from './pagination.types';

@Component({
  selector: 'ngpt-pagination',
  templateUrl: './pagination.html',
  styleUrl: './pagination.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  viewProviders: [provideIcons({ lucideArrowLeft, lucideArrowRight })],
})
export class Pagination {
  readonly prev = input<PaginationEntry | null>(null);
  readonly next = input<PaginationEntry | null>(null);
}
