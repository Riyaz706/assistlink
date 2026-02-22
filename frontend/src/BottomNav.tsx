import React from 'react';
import { View, Pressable, StyleSheet, Text, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, typography, accessibility } from './theme';
import { useAuth } from './context/AuthContext';

/** Screens that belong to each tab (for highlighting when on a detail screen) */
const SCREENS_BY_TAB: Record<string, string[]> = {
  CaregiverDashboard: ['CaregiverDashboard', 'CaregiverAppointmentDetailScreen', 'UpcomingVisitScreen', 'CaregiverMapScreen'],
  ScheduleScreen2: ['ScheduleScreen2'],
  ChatList2: ['ChatList2', 'ChatDetailScreen2'],
  ProfileScreen2: ['ProfileScreen2', 'Settings', 'EditProfile', 'ChangePassword', 'HelpSupport', 'NSSPortal'],
  CareRecipientDashboard: ['CareRecipientDashboard', 'BookingsScreen', 'BookingDetailScreen', 'MatchmakingScreen', 'PaymentScreen', 'UpcomingVisitScreen', 'CaregiverMapScreen'],
  NewRequestScreen: ['NewRequestScreen', 'MatchmakingScreen'],
  Schedule: ['Schedule'],
  ChatList: ['ChatList', 'ChatDetailsScreen'],
  Profile: ['Profile', 'Settings', 'EditProfile', 'ChangePassword', 'HelpSupport', 'NSSPortal'],
};

/**
 * Bottom tab navigation - PRD: 5 tabs for PWA mobile experience.
 * Role-aware: care_recipient gets Home/Requests/Schedule/Messages/Profile;
 * caregiver gets Home/Schedule/Messages/Profile (no Requests).
 */
const BottomNav = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();
  const isCaregiver = user?.role === 'caregiver' || (user as any)?.user_metadata?.role === 'caregiver';

  const currentRouteName = route?.name ?? '';

  const isActive = (screenName: string) => {
    if (currentRouteName === screenName) return true;
    const screens = SCREENS_BY_TAB[screenName];
    return screens ? screens.includes(currentRouteName) : false;
  };

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
              style={({ pressed }) => [
                styles.tab,
                active && styles.tabActive,
                pressed && styles.tabPressed,
              ]}
              onPress={() => navigation.navigate(name)}
              delayLongPress={200}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityHint={active ? `${label} tab selected` : `Switch to ${label} tab`}
              accessibilityState={{ selected: active }}
            >
              <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
                <Icon
                  name={(active ? icon : iconOutline) as any}
                  size={22}
                  color={active ? '#fff' : inactiveColor}
                />
              </View>
              <Text style={[styles.label, active && styles.activeLabel]} numberOfLines={1}>{label}</Text>
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
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 56,
    paddingBottom: Platform.OS === 'android' ? 4 : 6,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    minHeight: accessibility.minTouchTargetSize,
  },
  tabActive: {
    // Pill is on iconWrap; tab just gets no extra bg for flexibility
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: colors.secondary,
  },
  tabPressed: {
    opacity: 0.7,
  },
  label: {
    fontSize: 10,
    marginTop: 2,
    color: colors.textSecondary,
    fontWeight: typography.weightMedium,
  },
  activeLabel: {
    color: colors.secondary,
    fontWeight: typography.weightSemiBold,
  },
});

export default BottomNav;