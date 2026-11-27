import { Injectable, signal } from '@angular/core';

/** Open state of the one app-level search overlay, shared by every page and the ⌘K shortcut. */
@Injectable({ providedIn: 'root' })
export class SearchStore {
  readonly open = signal(false);

  show(): void {
    this.open.set(true);
  }

  hide(): void {
    this.open.set(false);
  }
}
