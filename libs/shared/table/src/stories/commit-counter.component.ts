import { ChangeDetectionStrategy, Component, effect, input, signal } from '@angular/core';

/** Demo-only instrumentation, not table API: ticks once per `data` emission, to make a story's
 * commit boundary (e.g. `debounce('blur')`) observable on screen — typing alone never ticks it. */
@Component({
  selector: 'ngp-commit-counter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="row-edit-story__counter">commits: {{ count() }}</span>`,
})
export class CommitCounterComponent {
  readonly data = input.required<readonly unknown[]>();

  protected readonly count = signal(0);

  constructor() {
    effect(() => {
      this.data();
      this.count.update((value) => value + 1);
    });
  }
}
