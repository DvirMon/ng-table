/**
 * What ticking a group's checkbox does to the rows beneath it. The inventory's sharpest split
 * (P10): AG Grid defaults to `'self'`, TanStack cascades to descendants, MUI X propagates in both
 * directions — three majors, three defaults. D16's position is that the library ships none of
 * them, so the story renders them as ordinary consumer code off one `rowsOf()` call. A single
 * hardcoded cascade would read as the library's position, which is the opposite of D16.
 *
 * MUI X's both-directions default is not a third mode here: reaching parents needs no write at
 * all, because a group's tri-state derives from `selectionStateOf()` on every render. It would be
 * a radio option that changes nothing on screen.
 */
export type CascadeMode = 'self' | 'descendants';
