/**
 * AssistLink Design System - per PRD (Product Requirements Document)
 * Colors, typography, and spacing for accessibility and production consistency.
 */

export const colors = {
  // Primary: Calm Blue - trustworthy and accessible
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primaryLight: '#3B82F6',
  // Secondary: Emerald Green - care and growth
  secondary: '#059669',
  secondaryDark: '#047857',
  secondaryLight: '#10B981',
  // Accent: Warm Amber - highlights and CTA
  accent: '#F59E0B',
  accentDark: '#D97706',
  accentLight: '#FBBF24',
  // Backgrounds
  background: '#F8FAFC',
  card: '#FFFFFF',
  // Text
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  // Semantic
  error: '#DC2626',
  success: '#059669',
  warning: '#F59E0B',
  // Borders & dividers
  border: '#E5E7EB',
  divider: '#E5E7EB',
};

export const typography = {
  // Minimum 16px for accessibility (PRD)
  minBodySize: 16,
  // Headings: Inter/Poppins style - clean, legible
  headingLarge: 24,
  headingMedium: 20,
  headingSmall: 18,
  // Body: Open Sans / System UI
  body: 16,
  bodySmall: 14,
  caption: 12,
  // Weights
  weightBold: '700' as const,
  weightSemiBold: '600' as const,
  weightMedium: '500' as const,
  weightNormal: '400' as const,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 9999,
};

/** High-contrast and large touch targets for accessibility */
export const accessibility = {
  minTouchTargetSize: 48,
  minFontSize: 16,
  contrastBorderWidth: 2,
};

/** High-contrast color set for accessibility mode */
export const highContrastColors = {
  ...colors,
  primary: '#1D4ED8',
  textPrimary: '#111827',
  textSecondary: '#374151',
  border: '#9CA3AF',
  background: '#F3F4F6',
  card: '#FFFFFF',
};

/**
 * Typography scale for large-text mode (multiplier for base sizes).
 */
export function getTypographyScale(largeText: boolean): Record<keyof typeof typography, number | string> {
  const scale = largeText ? 1.2 : 1;
  return {
    ...typography,
    minBodySize: largeText ? 18 : 16,
    headingLarge: Math.round(typography.headingLarge * scale),
    headingMedium: Math.round(typography.headingMedium * scale),
    headingSmall: Math.round(typography.headingSmall * scale),
    body: Math.round(typography.body * scale),
    bodySmall: Math.round(typography.bodySmall * scale),
    caption: Math.round(typography.caption * scale),
    weightBold: typography.weightBold,
    weightSemiBold: typography.weightSemiBold,
    weightMedium: typography.weightMedium,
    weightNormal: typography.weightNormal,
  };
}

export default { colors, typography, spacing, borderRadius, accessibility, highContrastColors, getTypographyScale };
