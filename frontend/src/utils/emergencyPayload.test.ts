/**
 * Unit tests: emergency trigger payload and status.
 * Purpose: Ensure location is never invalid and status is type-safe.
 * Run: pnpm test src/utils/emergencyPayload.test.ts
 * Failure: Emergency payload or status bug; fix before release.
 */
import { describe, it, expect } from 'vitest';
import {
  buildEmergencyTriggerPayload,
  isEmergencyStatus,
  EMERGENCY_STATUSES,
  type EmergencyLocation,
} from './emergencyPayload';

describe('buildEmergencyTriggerPayload', () => {
  it('returns valid location shape when given null', () => {
    const { location } = buildEmergencyTriggerPayload(null);
    expect(location).toHaveProperty('latitude', 0);
    expect(location).toHaveProperty('longitude', 0);
    expect(location).toHaveProperty('location_name', 'Unknown Location');
    expect(location).toHaveProperty('timestamp');
    expect(typeof location.timestamp).toBe('string');
  });

  it('merges provided location and fills defaults', () => {
    const { location } = buildEmergencyTriggerPayload({
      latitude: 12.34,
      longitude: 56.78,
      location_name: 'Home',
    });
    expect(location.latitude).toBe(12.34);
    expect(location.longitude).toBe(56.78);
    expect(location.location_name).toBe('Home');
    expect(location.timestamp).toBeDefined();
  });

  it('overrides NaN with 0', () => {
    const { location } = buildEmergencyTriggerPayload({
      latitude: Number.NaN,
      longitude: 56.78,
    });
    expect(location.latitude).toBe(0);
    expect(location.longitude).toBe(56.78);
  });

  it('sets location_name to Current Location when coords non-zero', () => {
    const { location } = buildEmergencyTriggerPayload({ latitude: 1, longitude: 1 });
    expect(location.location_name).toBe('Current Location');
  });

  it('adds timestamp when missing', () => {
    const { location } = buildEmergencyTriggerPayload({ latitude: 0, longitude: 0 });
    expect(location.timestamp).toBeDefined();
    expect(new Date(location.timestamp!).getTime()).not.toBeNaN();
  });
});

describe('isEmergencyStatus', () => {
  it('returns true for valid statuses', () => {
    EMERGENCY_STATUSES.forEach((s) => expect(isEmergencyStatus(s)).toBe(true));
  });

  it('returns false for invalid values', () => {
    expect(isEmergencyStatus('')).toBe(false);
    expect(isEmergencyStatus('pending')).toBe(false);
    expect(isEmergencyStatus(123)).toBe(false);
    expect(isEmergencyStatus(null)).toBe(false);
    expect(isEmergencyStatus(undefined)).toBe(false);
  });
});
