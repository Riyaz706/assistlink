/**
 * Unit tests: client-side validation and role/booking helpers.
 * Purpose: Prevent invalid form submissions and wrong role routing.
 * Run: pnpm test src/utils/validation.test.ts
 * Failure: Validation or role logic bug; fix before release.
 */
import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validatePassword,
  validatePhoneIN,
  parseDobToIso,
  getRoleForNavigation,
  bookingSlotsOverlap,
  EMAIL_REGEX,
} from './validation';

describe('validateEmail', () => {
  it('returns valid for correct email', () => {
    expect(validateEmail('u@example.com')).toEqual({ valid: true });
    expect(validateEmail('  user+tag@domain.co  ')).toEqual({ valid: true });
  });

  it('returns invalid when empty', () => {
    expect(validateEmail('')).toEqual({ valid: false, message: 'Email is required' });
    expect(validateEmail('   ')).toEqual({ valid: false, message: 'Email is required' });
  });

  it('returns invalid for bad format', () => {
    expect(validateEmail('no-at')).toEqual({ valid: false, message: 'Please enter a valid email address' });
    expect(validateEmail('@nodomain.com')).toEqual({ valid: false, message: 'Please enter a valid email address' });
    expect(validateEmail('nodomain@')).toEqual({ valid: false, message: 'Please enter a valid email address' });
  });

  it('returns invalid when too long', () => {
    const long = 'a'.repeat(256) + '@b.com';
    expect(validateEmail(long)).toEqual({ valid: false, message: 'Email is too long' });
  });
});

describe('validatePassword', () => {
  it('returns valid for strong password', () => {
    expect(validatePassword('Pass1234')).toEqual({ valid: true });
    expect(validatePassword('MyP4ssw0rd')).toEqual({ valid: true });
  });

  it('returns invalid when empty', () => {
    expect(validatePassword('')).toEqual({ valid: false, message: 'Password is required' });
  });

  it('returns invalid when too short', () => {
    expect(validatePassword('Ab1')).toEqual({ valid: false, message: 'Password must be at least 8 characters long' });
    expect(validatePassword('short')).toEqual({ valid: false, message: 'Password must be at least 8 characters long' });
  });

  it('returns invalid when no letter or no number', () => {
    expect(validatePassword('12345678')).toEqual({ valid: false, message: 'Password must contain at least one letter and one number' });
    expect(validatePassword('abcdefgh')).toEqual({ valid: false, message: 'Password must contain at least one letter and one number' });
  });

  it('respects custom minLength', () => {
    expect(validatePassword('Ab1', 3)).toEqual({ valid: true });
    expect(validatePassword('Ab', 3)).toEqual({ valid: false, message: 'Password must be at least 3 characters long' });
  });
});

describe('validatePhoneIN', () => {
  it('returns valid for 10-digit Indian mobile', () => {
    expect(validatePhoneIN('9876543210')).toEqual({ valid: true });
    expect(validatePhoneIN('6123456789')).toEqual({ valid: true });
  });

  it('returns valid when empty (optional)', () => {
    expect(validatePhoneIN('')).toEqual({ valid: true });
    expect(validatePhoneIN('   ')).toEqual({ valid: true });
  });

  it('returns invalid for wrong length', () => {
    expect(validatePhoneIN('123')).toEqual({ valid: false, message: 'Please enter a valid 10-digit phone number' });
    expect(validatePhoneIN('12345678901')).toEqual({ valid: false, message: 'Please enter a valid 10-digit phone number' });
  });

  it('returns invalid when not starting with 6-9', () => {
    expect(validatePhoneIN('5123456789')).toEqual({ valid: false, message: 'Phone number should start with 6, 7, 8, or 9' });
  });
});

describe('parseDobToIso', () => {
  it('parses DD/MM/YYYY to ISO', () => {
    const iso = parseDobToIso('15/06/1990');
    expect(iso).toBeDefined();
    const d = new Date(iso!);
    expect(d.getFullYear()).toBe(1990);
    expect(d.getMonth()).toBe(5); // June = 5
    expect(d.getDate()).toBe(15);
  });

  it('returns undefined for empty', () => {
    expect(parseDobToIso('')).toBeUndefined();
    expect(parseDobToIso('   ')).toBeUndefined();
  });

  it('returns undefined for invalid', () => {
    expect(parseDobToIso('not-a-date')).toBeUndefined();
    expect(parseDobToIso('1/2')).toBeUndefined();
    expect(parseDobToIso('31/02/2000')).toBeUndefined(); // invalid Feb 31
  });
});

describe('getRoleForNavigation', () => {
  it('returns caregiver when user.role is caregiver', () => {
    expect(getRoleForNavigation({ role: 'caregiver' })).toBe('caregiver');
  });

  it('returns care_recipient when user.role is care_recipient', () => {
    expect(getRoleForNavigation({ role: 'care_recipient' })).toBe('care_recipient');
  });

  it('returns care_recipient when role is missing (fallback)', () => {
    expect(getRoleForNavigation({})).toBe('care_recipient');
    expect(getRoleForNavigation(null)).toBe('care_recipient');
    expect(getRoleForNavigation({ role: undefined })).toBe('care_recipient');
  });

  it('returns care_recipient for unknown role string', () => {
    expect(getRoleForNavigation({ role: 'admin' as any })).toBe('care_recipient');
  });
});

describe('bookingSlotsOverlap', () => {
  it('returns true when slots overlap', () => {
    expect(bookingSlotsOverlap('2025-06-01T10:00:00Z', '2025-06-01T12:00:00Z', '2025-06-01T11:00:00Z', '2025-06-01T13:00:00Z')).toBe(true);
    expect(bookingSlotsOverlap('2025-06-01T11:00:00Z', '2025-06-01T13:00:00Z', '2025-06-01T10:00:00Z', '2025-06-01T12:00:00Z')).toBe(true);
  });

  it('returns false when slots do not overlap', () => {
    expect(bookingSlotsOverlap('2025-06-01T10:00:00Z', '2025-06-01T11:00:00Z', '2025-06-01T12:00:00Z', '2025-06-01T13:00:00Z')).toBe(false);
  });

  it('returns false when end equals next start (no overlap)', () => {
    expect(bookingSlotsOverlap('2025-06-01T10:00:00Z', '2025-06-01T12:00:00Z', '2025-06-01T12:00:00Z', '2025-06-01T14:00:00Z')).toBe(false);
  });

  it('handles Date objects', () => {
    const a = new Date('2025-06-01T10:00:00Z');
    const b = new Date('2025-06-01T12:00:00Z');
    const c = new Date('2025-06-01T11:00:00Z');
    const d = new Date('2025-06-01T13:00:00Z');
    expect(bookingSlotsOverlap(a, b, c, d)).toBe(true);
  });
});

describe('EMAIL_REGEX', () => {
  it('matches valid emails', () => {
    expect(EMAIL_REGEX.test('a@b.co')).toBe(true);
    expect(EMAIL_REGEX.test('user+tag@domain.example.com')).toBe(true);
  });

  it('rejects invalid', () => {
    expect(EMAIL_REGEX.test('')).toBe(false);
    expect(EMAIL_REGEX.test('no-at')).toBe(false);
    expect(EMAIL_REGEX.test('@.com')).toBe(false);
  });
});
