import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Suppress console in tests unless DEBUG is set
if (!process.env.DEBUG) {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
}
