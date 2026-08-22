import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'ngpt-code-chip',
  templateUrl: './code-chip.html',
  styleUrl: './code-chip.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CodeChip {}
