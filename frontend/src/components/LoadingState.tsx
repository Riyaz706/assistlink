/**
 * Full-screen or inline loading state (skeleton alternative).
 * Use when a screen or section is fetching data.
 */
import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../theme';

interface LoadingStateProps {
  message?: string;
  inline?: boolean;
}

export function LoadingState({ message = 'Loading...', inline = false }: LoadingStateProps) {
  const content = (
    <>
      <ActivityIndicator size="large" color={colors.secondary} accessibilityLabel="Loading" />
      <Text style={styles.text}>{message}</Text>
    </>
  );

  if (inline) {
    return (
      <View style={[styles.container, styles.inline]} accessibilityRole="progressbar" accessibilityLabel={message}>
        {content}
      </View>
    );
  }
  return (
    <View style={styles.container} accessibilityRole="progressbar" accessibilityLabel={message}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    minHeight: 200,
  },
  inline: {
    flex: 0,
    minHeight: 120,
  },
  text: {
    marginTop: spacing.md,
    fontSize: typography.body,
    color: colors.textSecondary,
  },
});
