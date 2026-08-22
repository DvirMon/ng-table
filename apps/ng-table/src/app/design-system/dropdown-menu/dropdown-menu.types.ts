/**
 * One row in `ngpt-dropdown-menu`. `group` clusters consecutive items under a shared uppercase
 * label and inserts a divider before the first item of a new group (spec: "Optional group label"
 * / "Divider between groups"). `selected` marks the current value — accent text, trailing check
 * icon, `role="menuitemradio"` — omit it entirely for a plain command item (`role="menuitem"`).
 */
export interface DropdownMenuItem {
  readonly id: string;
  readonly label: string;
  readonly disabled?: boolean;
  readonly selected?: boolean;
  readonly group?: string;
}
