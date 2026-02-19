import React from 'react';
import { View, Pressable, StyleSheet, Text, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, typography, accessibility } from './theme';
import { useAuth } from './context/AuthContext';

/**
 * Bottom tab navigation - PRD: 5 tabs for PWA mobile experience.
 * Role-aware: care_recipient gets Home/Requests/Schedule/Messages/Profile;
 * caregiver gets Home/Schedule/Messages/Profile (no Requests).
 */
const BottomNav = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();
  const isCaregiver = user?.role === 'caregiver';

  const isActive = (screenName: string) => route?.name === screenName;
  const activeColor = colors.secondary;
  const inactiveColor = colors.textSecondary;

  const tabs = isCaregiver
    ? [
      { name: 'CaregiverDashboard', label: 'Home', icon: 'home', iconOutline: 'home-outline' },
      { name: 'ScheduleScreen2', label: 'Schedule', icon: 'calendar-clock', iconOutline: 'calendar-clock-outline' },
      { name: 'ChatList2', label: 'Messages', icon: 'message-text', iconOutline: 'message-text-outline' },
      { name: 'ProfileScreen2', label: 'Profile', icon: 'account-circle', iconOutline: 'account-circle-outline' },
    ]
    : [
      { name: 'CareRecipientDashboard', label: 'Home', icon: 'home', iconOutline: 'home-outline' },
      { name: 'NewRequestScreen', label: 'Requests', icon: 'plus-circle', iconOutline: 'plus-circle-outline' },
      { name: 'Schedule', label: 'Schedule', icon: 'calendar-clock', iconOutline: 'calendar-clock-outline' },
      { name: 'ChatList', label: 'Messages', icon: 'message-text', iconOutline: 'message-text-outline' },
      { name: 'Profile', label: 'Profile', icon: 'account-circle', iconOutline: 'account-circle-outline' },
    ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={styles.container}>
        {tabs.map(({ name, label, icon, iconOutline }) => {
          const active = isActive(name);
          return (
            <Pressable
              key={name}
              style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
              onPress={() => navigation.navigate(name)}

              delayLongPress={200}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: active }}
            >
              <Icon
                name={(active ? icon : iconOutline) as any}
                size={26}
                color={active ? activeColor : inactiveColor}
              />
              <Text style={[styles.label, active && styles.activeLabel]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.card,
  },
  container: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: Math.max(70, accessibility.minTouchTargetSize + 16),
    paddingBottom: Platform.OS === 'android' ? 8 : 10,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 56,
    minHeight: accessibility.minTouchTargetSize,
  },
  tabPressed: {
    opacity: 0.6,
  },
  label: {
    fontSize: typography.bodySmall,
    marginTop: 4,
    color: colors.textSecondary,
  },
  activeLabel: {
    color: colors.secondary,
    fontWeight: typography.weightSemiBold,
  },
});

export default BottomNav;