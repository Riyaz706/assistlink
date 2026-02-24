/**
 * Reusable Card component — consistent structure, spacing, and elevation.
 * Accessibility-first: large touch targets, high contrast.
 */
import React from 'react';
import { View, StyleSheet, ViewStyle, Pressable, Platform } from 'react-native';
import { colors, spacing, borderRadius, shadows } from '../theme';

type CardProps = {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  padded?: boolean;
  elevated?: boolean;
  accessibilityLabel?: string;
};

export default function Card({
  children,
  onPress,
  style,
  padded = true,
  elevated = true,
  accessibilityLabel,
}: CardProps) {
  const cardStyle = [
    styles.card,
    padded && styles.padded,
    elevated && shadows.card,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          ...cardStyle,
          pressed && styles.pressed,
          style,
        ]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[...cardStyle, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  padded: {
    padding: spacing.lg,
  },
  pressed: {
    opacity: 0.95,
  },
});
