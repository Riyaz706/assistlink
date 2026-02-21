/**
 * Client-side validation utilities for AssistLink.
 * Used by forms and API payloads; keep in sync with backend validators where applicable.
 */

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value: string): { valid: boolean; message?: string } {
  if (!value || !value.trim()) return { valid: false, message: 'Email is required' };
  const trimmed = value.trim();
  if (!EMAIL_REGEX.test(trimmed)) return { valid: false, message: 'Please enter a valid email address' };
  if (trimmed.length > 255) return { valid: false, message: 'Email is too long' };
  return { valid: true };
}

export function validatePassword(value: string, minLength: number = 8): { valid: boolean; message?: string } {
  if (!value) return { valid: false, message: 'Password is required' };
  if (value.length < minLength) return { valid: false, message: `Password must be at least ${minLength} characters long` };
  if (value.length > 128) return { valid: false, message: 'Password is too long' };
  const hasLetter = /[a-zA-Z]/.test(value);
  const hasNumber = /\d/.test(value);
  if (!(hasLetter && hasNumber)) return { valid: false, message: 'Password must contain at least one letter and one number' };
  return { valid: true };
}

/** Indian 10-digit mobile (optional +91). */
export function validatePhoneIN(value: string): { valid: boolean; message?: string } {
  if (!value || !value.trim()) return { valid: true }; // optional
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 10) return { valid: false, message: 'Please enter a valid 10-digit phone number' };
  if (!/^[6-9]/.test(digits)) return { valid: false, message: 'Phone number should start with 6, 7, 8, or 9' };
  return { valid: true };
}

/**
 * Parse DD/MM/YYYY to ISO date string for API.
 * Returns undefined if empty or invalid (including invalid day-of-month).
 */
export function parseDobToIso(dob: string): string | undefined {
  if (!dob || !dob.trim()) return undefined;
  const parts = dob.trim().split('/').map((s) => parseInt(s, 10));
  const [dd, mm, yyyy] = parts;
  if (!dd || !mm || !yyyy) return undefined;
  const d = new Date(yyyy, mm - 1, dd);
  if (isNaN(d.getTime())) return undefined;
  if (d.getDate() !== dd || d.getMonth() !== mm - 1 || d.getFullYear() !== yyyy) return undefined;
  return d.toISOString();
}

export type UserRole = 'care_recipient' | 'caregiver';

/**
 * Resolve role for navigation; same logic as AppNavigator.
 * Prevents wrong dashboard when role is missing from profile.
 */
export function getRoleForNavigation(user: { role?: string } | null): UserRole {
  const role = user?.role ?? 'care_recipient';
  return role === 'caregiver' ? 'caregiver' : 'care_recipient';
}

/**
 * Check if two booking windows overlap (for conflict detection).
 * All times in ISO string or Date.
 */
export function bookingSlotsOverlap(
  start1: string | Date,
  end1: string | Date,
  start2: string | Date,
  end2: string | Date
): boolean {
  const s1 = new Date(start1).getTime();
  const e1 = new Date(end1).getTime();
  const s2 = new Date(start2).getTime();
  const e2 = new Date(end2).getTime();
  if (s1 >= e1 || s2 >= e2) return false;
  return s1 < e2 && s2 < e1;
}
