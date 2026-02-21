/**
 * Returns theme (colors, typography) adjusted for accessibility settings.
 * Use in screens to apply large text and high contrast.
 */
import { useAccessibility } from '../context/AccessibilityContext';
import { colors, highContrastColors, getTypographyScale, typography } from '../theme';

export function useThemeAccessibility() {
  const { largeText, highContrast, setLargeText, setHighContrast } = useAccessibility();
  const activeColors = highContrast ? highContrastColors : colors;
  const activeTypography = getTypographyScale(largeText);
  return {
    colors: activeColors,
    typography: activeTypography,
    largeText,
    highContrast,
    setLargeText,
    setHighContrast,
  };
}
