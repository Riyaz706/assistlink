/**
 * Map types for view-only visualization.
 * No business logic; coordinates come from app/backend.
 */

export interface MapCoordinate {
  lat: number;
  lng: number;
}

export interface MapMarkerBase {
  id: string;
  position: MapCoordinate;
  label: string;
  /** Optional short description for info window (accessible as text). */
  description?: string;
}

export interface UserLocationMarker extends MapMarkerBase {
  type: 'user';
}

export interface CaregiverMarker extends MapMarkerBase {
  type: 'caregiver';
  /** Optional; e.g. "Available today" */
  subtitle?: string;
}

export type MapMarker = UserLocationMarker | CaregiverMarker;

export interface MapViewProps {
  /** API key from env; map will show fallback if missing or invalid. */
  apiKey: string | undefined;
  /** User position (e.g. from geolocation or backend). */
  userPosition: MapCoordinate | null;
  /** Caregiver markers (from backend/list). */
  caregivers: CaregiverMarker[];
  /** Initial center when no user position (e.g. city default). */
  defaultCenter?: MapCoordinate;
  /** Initial zoom (e.g. 12–14). */
  defaultZoom?: number;
  /** Optional: single location for booking/emergency preview. */
  highlightPosition?: MapCoordinate | null;
  /** Mode affects styling only (e.g. emergency = high contrast). */
  mode?: 'default' | 'emergency';
  /** Accessibility: aria label for the map container. */
  ariaLabel?: string;
  /** Optional className for the outer container. */
  className?: string;
}
