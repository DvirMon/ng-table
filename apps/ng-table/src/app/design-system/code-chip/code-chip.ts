import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Attribute-hosted on the consumer's own `<code>` — the element this primitive exists to style, so
 * no wrapper ships and the chip is a single inline box in the text flow (ADR-0005).
 *
 * No inputs: projected code text only.
 */
@Component({
  selector: 'code[ngptCodeChip]',
  templateUrl: './code-chip.html',
  styleUrl: './code-chip.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CodeChip {}
