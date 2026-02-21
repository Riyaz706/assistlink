/**
 * Unit tests: error classification and message extraction.
 * Purpose: Correct user-facing messages and retry/offline behavior.
 * Run: pnpm test src/hooks/useErrorHandler.test.ts
 * Failure: Error handling regression; fix before release.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('react-native', () => ({ Alert: { alert: vi.fn() }, Platform: { OS: 'web' } }));
vi.mock('@sentry/react-native', () => ({ captureException: vi.fn() }));

import {
  isNetworkError,
  isAuthError,
  isValidationError,
  formatValidationErrors,
  retryOperation,
} from './useErrorHandler';

describe('isNetworkError', () => {
  it('returns true for ERR_NETWORK, ECONNABORTED, NETWORK_ERROR, TIMEOUT', () => {
    expect(isNetworkError({ code: 'ERR_NETWORK' })).toBe(true);
    expect(isNetworkError({ code: 'ECONNABORTED' })).toBe(true);
    expect(isNetworkError({ code: 'NETWORK_ERROR' })).toBe(true);
    expect(isNetworkError({ code: 'TIMEOUT' })).toBe(true);
  });

  it('returns true when message contains network, connection, or timeout', () => {
    expect(isNetworkError({ message: 'Network request failed' })).toBe(true);
    expect(isNetworkError({ message: 'Connection refused' })).toBe(true);
    expect(isNetworkError({ message: 'Request timeout. Please check' })).toBe(true);
  });

  it('returns false for other errors', () => {
    expect(isNetworkError({ code: 'ERR_BAD_REQUEST' })).toBe(false);
    expect(isNetworkError({ message: 'Validation failed' })).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});

describe('isAuthError', () => {
  it('returns true for 401 and 403', () => {
    expect(isAuthError({ statusCode: 401 })).toBe(true);
    expect(isAuthError({ statusCode: 403 })).toBe(true);
    expect(isAuthError({ response: { status: 401 } })).toBe(true);
    expect(isAuthError({ response: { status: 403 } })).toBe(true);
  });

  it('returns false for other status codes', () => {
    expect(isAuthError({ statusCode: 400 })).toBe(false);
    expect(isAuthError({ statusCode: 500 })).toBe(false);
    expect(isAuthError({})).toBe(false);
  });
});

describe('isValidationError', () => {
  it('returns true for 422 and 400', () => {
    expect(isValidationError({ statusCode: 422 })).toBe(true);
    expect(isValidationError({ statusCode: 400 })).toBe(true);
    expect(isValidationError({ response: { status: 422 } })).toBe(true);
  });

  it('returns false for other status codes', () => {
    expect(isValidationError({ statusCode: 401 })).toBe(false);
    expect(isValidationError({})).toBe(false);
  });
});

describe('formatValidationErrors', () => {
  it('returns array of field: message from validation_errors', () => {
    const err = {
      response: {
        data: {
          error: {
            details: {
              validation_errors: [
                { field: 'email', message: 'Invalid email' },
                { field: 'password', message: 'Too short' },
              ],
            },
          },
        },
      },
    };
    expect(formatValidationErrors(err)).toEqual(['email: Invalid email', 'password: Too short']);
  });

  it('uses defaults when field or message missing', () => {
    const err = {
      response: {
        data: {
          error: {
            details: {
              validation_errors: [{ field: null }, {}],
            },
          },
        },
      },
    };
    const out = formatValidationErrors(err);
    expect(out).toHaveLength(2);
    expect(out[0]).toContain('Field');
    expect(out[1]).toContain('Invalid value');
  });

  it('returns empty array when not validation format', () => {
    expect(formatValidationErrors({})).toEqual([]);
    expect(formatValidationErrors({ response: { data: {} } })).toEqual([]);
  });
});

describe('retryOperation', () => {
  it('returns result on first success', async () => {
    const op = vi.fn().mockResolvedValue(42);
    const result = await retryOperation(op, { maxRetries: 3, delayMs: 10 });
    expect(result).toBe(42);
    expect(op).toHaveBeenCalledTimes(1);
  });

  it('retries then succeeds', async () => {
    const op = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce(1);
    const result = await retryOperation(op, { maxRetries: 3, delayMs: 5 });
    expect(result).toBe(1);
    expect(op).toHaveBeenCalledTimes(2);
  });

  it('throws after maxRetries', async () => {
    const op = vi.fn().mockRejectedValue(new Error('fail'));
    await expect(retryOperation(op, { maxRetries: 2, delayMs: 5 })).rejects.toThrow('fail');
    expect(op).toHaveBeenCalledTimes(2);
  });

  it('calls onRetry before each retry (not after final failure)', async () => {
    const onRetry = vi.fn();
    const op = vi.fn().mockRejectedValue(new Error('fail'));
    await expect(retryOperation(op, { maxRetries: 2, delayMs: 5, onRetry })).rejects.toThrow();
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
  });
});
