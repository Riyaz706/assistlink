import React from 'react';
import { View, StyleSheet, ViewStyle, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomNav from './BottomNav';

const MAX_CONTENT_WIDTH = 600;

/**
 * Shared layout for all main app screens: content fills the space above a bottom-aligned nav bar.
 * Responsive: constrains width on large screens and adds horizontal padding for readability.
 * Use the same structure everywhere so the nav bar is always at the bottom.
 */
export default function ScreenWithBottomNav({
  children,
  style,
  contentStyle,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}) {
  const { width } = useWindowDimensions();
  const isWide = width > MAX_CONTENT_WIDTH;
  const paddingHorizontal = isWide ? (width - MAX_CONTENT_WIDTH) / 2 : 0;

  return (
    <SafeAreaView
      style={[styles.root, style]}
      edges={['top', 'left', 'right']}
      accessibilityRole="none"
    >
      <View
        style={[
          styles.content,
          contentStyle,
          paddingHorizontal > 0 && { paddingHorizontal },
        ]}
      >
        {children}
      </View>
      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
