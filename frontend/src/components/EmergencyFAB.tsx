/**
 * Persistent Emergency SOS button — visible on all screens for care recipients.
 * Positioned bottom-right, above the tab bar, for easy reach and clear alignment.
 */
import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { navigate } from '../navigation/RootNavigation';
import { accessibility } from '../theme';

const SIZE = Math.max(56, accessibility.minTouchTargetSize + 8);
const RED = '#EF4444';
// Sit above bottom tab bar (tab bar ~70px + safe area)
const TAB_BAR_HEIGHT = 72;
const FAB_MARGIN = 12;

export function EmergencyFAB() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const isCareRecipient = user?.role === 'care_recipient';
  if (!user || !isCareRecipient) return null;

  const bottom = insets.bottom + TAB_BAR_HEIGHT + FAB_MARGIN;

  return (
    <View style={[styles.wrapper, { bottom }]} pointerEvents="box-none">
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={() => navigate('EmergencyScreen')}
        accessibilityLabel="Emergency SOS. Open emergency assistance."
        accessibilityRole="button"
        accessibilityHint="Opens emergency screen to send an alert to caregivers."
      >
        <MaterialCommunityIcons name="alert-octagon" size={28} color="#FFF" />
        <Text style={styles.label}>SOS</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    right: 20,
    left: undefined,
    zIndex: 9999,
    alignItems: 'flex-end',
  },
  fab: {
    width: SIZE,
    minHeight: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: RED,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: RED,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#FCA5A5',
  },
  fabPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  label: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
