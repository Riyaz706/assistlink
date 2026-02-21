/**
 * Provides theme (colors, typography) adjusted for accessibility (large text, high contrast).
 * Must be used inside AccessibilityProvider.
 */
import React from 'react';
import { createContext, useContext } from 'react';
import { useThemeAccessibility } from '../hooks/useThemeAccessibility';

type ThemeContextType = ReturnType<typeof useThemeAccessibility>;

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const theme = useThemeAccessibility();
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (ctx === undefined) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
