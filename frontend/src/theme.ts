/**
 * AssistLink Design System — Premium, Accessible, Elderly-Friendly
 * WCAG AA+ / Production-ready UI/UX
 * 
 * COLOR SYSTEM (strict):
 * Primary: #2563EB | Secondary: #059669 | Accent/CTA: #F59E0B
 * Background: #F8FAFC | Card: #FFFFFF
 * Text Primary: #1F2937 | Text Secondary: #6B7280
 */

export const colors = {
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primaryLight: '#DBEAFE',
  secondary: '#059669',
  secondaryDark: '#047857',
  secondaryLight: '#D1FAE5',
  accent: '#F59E0B',
  accentDark: '#D97706',
  accentLight: '#FEF3C7',
  background: '#F8FAFC',
  card: '#FFFFFF',
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  error: '#DC2626',
  success: '#059669',
  warning: '#F59E0B',
  border: '#E5E7EB',
  divider: '#E5E7EB',
};

export const typography = {
  minBodySize: 16,
  headingLarge: 26,
  headingMedium: 20,
  headingSmall: 18,
  body: 16,
  bodySmall: 14,
  caption: 12,
  label: 14,
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

/** Layout grid — consistent content margins */
export const layout = {
  screenPadding: 20,
  cardPadding: 20,
  cardGap: 16,
  sectionGap: 24,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

/** Shadows for elevation hierarchy */
export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHover: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  button: {
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
};

/** Accessibility — minimum touch targets 48px */
export const accessibility = {
  minTouchTargetSize: 48,
  minFontSize: 16,
  contrastBorderWidth: 2,
};

export const highContrastColors = {
  ...colors,
  primary: '#1D4ED8',
  textPrimary: '#111827',
  textSecondary: '#374151',
  border: '#9CA3AF',
  background: '#F3F4F6',
  card: '#FFFFFF',
};

export function getTypographyScale(largeText: boolean): Record<string, number | string> {
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

export default { colors, typography, spacing, layout, borderRadius, shadows, accessibility, highContrastColors, getTypographyScale };
