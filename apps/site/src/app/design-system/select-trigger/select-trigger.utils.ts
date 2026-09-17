import type { DropdownMenuItem } from '../dropdown-menu/dropdown-menu.types';

/**
 * Marks the option whose id matches `value` as selected, wiring it into `ngpt-dropdown-menu`'s
 * `selected` flag (renders as `menuitemradio` + accent check per dropdown-menu's role model).
 */
export function withSelection(
  options: readonly DropdownMenuItem[],
  value: string | undefined,
): readonly DropdownMenuItem[] {
  return options.map((option) => ({ ...option, selected: option.id === value }));
}
