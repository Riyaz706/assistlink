/**
 * Map constants. No hardcoded coordinates for business logic.
 */

/** Default zoom when only one point or no user location. */
export const DEFAULT_ZOOM = 13;

/** Minimum zoom for multi-marker view. */
export const MIN_ZOOM = 10;

/** Maximum zoom for street-level. */
export const MAX_ZOOM = 18;

/** Fallback center only when no positions at all (e.g. India). */
export const FALLBACK_CENTER = { lat: 20.5937, lng: 78.9629 };

/** Map container min height (mobile-friendly). */
export const MAP_MIN_HEIGHT_PX = 280;

/** Large marker scale for elderly-friendly UI (Google Maps default is 1). */
export const MARKER_SCALE = 1.3;
