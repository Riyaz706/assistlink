/**
 * Emergency trigger payload and location fallback.
 * Ensures we never send invalid or missing location shape to API.
 */

export interface EmergencyLocation {
  latitude: number;
  longitude: number;
  location_name?: string;
  timestamp?: string;
}

const DEFAULT_LOCATION: EmergencyLocation = {
  latitude: 0,
  longitude: 0,
  location_name: 'Unknown Location',
  timestamp: new Date().toISOString(),
};

/**
 * Build payload for POST /api/emergency/trigger.
 * Uses provided location or defaults so API always receives a valid shape.
 */
export function buildEmergencyTriggerPayload(location: Partial<EmergencyLocation> | null): { location: EmergencyLocation } {
  const merged: EmergencyLocation = {
    ...DEFAULT_LOCATION,
    ...(location && typeof location === 'object' ? location : {}),
  };
  if (typeof merged.latitude !== 'number' || Number.isNaN(merged.latitude)) merged.latitude = 0;
  if (typeof merged.longitude !== 'number' || Number.isNaN(merged.longitude)) merged.longitude = 0;
  if (!merged.timestamp) merged.timestamp = new Date().toISOString();
  const hasCoords = merged.latitude !== 0 || merged.longitude !== 0;
  if (!merged.location_name || merged.location_name === 'Unknown Location')
    merged.location_name = hasCoords ? 'Current Location' : 'Unknown Location';
  return { location: merged };
}

/**
 * Valid emergency statuses from API.
 */
export const EMERGENCY_STATUSES = ['active', 'acknowledged', 'resolved'] as const;
export type EmergencyStatus = (typeof EMERGENCY_STATUSES)[number];

export function isEmergencyStatus(s: unknown): s is EmergencyStatus {
  return typeof s === 'string' && EMERGENCY_STATUSES.includes(s as EmergencyStatus);
}
