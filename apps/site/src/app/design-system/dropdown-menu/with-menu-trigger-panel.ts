import { TemplateRef, computed, effect, type Signal } from '@angular/core';
import { injectMenuTriggerState } from 'ng-primitives/menu';
import type { NgpOverlayTemplateContext } from 'ng-primitives/portal';

/**
 * Shared `[ngpMenuTrigger]` wiring for a component that renders `ngpt-dropdown-menu` inside its
 * own `<ng-template>` (`dropdown-pill`, `select-trigger`). `viewChild.required` must stay a
 * literal field initializer in each component (compiler restriction — NG8110), so callers pass
 * that signal in; this only owns the trigger-state sync and `open` derivation. Must be called
 * from a component field initializer or constructor (injection context).
 */
export function withMenuTriggerPanel(
  menu: Signal<TemplateRef<NgpOverlayTemplateContext<unknown>>>,
): { open: Signal<boolean> } {
  const triggerState = injectMenuTriggerState();
  const open = computed<boolean>(() => triggerState().open());

  effect(() => triggerState().setMenu(menu()));

  return { open };
}
