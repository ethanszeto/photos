/** Max edge length of small WebP thumbs (see lambda/mediaPipelines/image.js). */
export const SMALL_THUMBNAIL_MAX_PX = 300;

/** Max edge length of medium WebP thumbs (see lambda/mediaPipelines/image.js). */
export const MEDIUM_THUMBNAIL_MAX_PX = 1600;

/** Gap between grid cells — keep in sync with VirtualizedGrid. */
export const GRID_GAP_PX = 2;

/** Default Dynamo/API page size — shared by server fetch and client trim logic. */
export const DEFAULT_PAGE_SIZE = 100;

/** Max items kept in client memory (~24 pages at 100/page). */
export const MAX_LOADED_ITEMS = 2400;
