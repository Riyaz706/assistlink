/**
 * Bottom Tab Navigation — Premium, Accessible
 * Large icons (28px), clear labels (12px min), 56px min height, distinct active state.
 */
import React from 'react';
import { View, Pressable, StyleSheet, Text, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, typography, accessibility } from './theme';
import { useAuth } from './context/AuthContext';

const SCREENS_BY_TAB: Record<string, string[]> = {
  CaregiverDashboard: ['CaregiverDashboard', 'CaregiverAppointmentDetailScreen', 'UpcomingVisitScreen', 'CaregiverMapScreen'],
  ScheduleScreen2: ['ScheduleScreen2'],
  ChatList2: ['ChatList2', 'ChatDetailScreen2'],
  ProfileScreen2: ['ProfileScreen2', 'Settings', 'LanguagePicker', 'EditProfile', 'ChangePassword', 'HelpSupport', 'NSSPortal'],
  CareRecipientDashboard: ['CareRecipientDashboard', 'BookingsScreen', 'BookingDetailScreen', 'MatchmakingScreen', 'PaymentScreen', 'UpcomingVisitScreen', 'CaregiverMapScreen'],
  NewRequestScreen: ['NewRequestScreen', 'MatchmakingScreen'],
  Schedule: ['Schedule'],
  ChatList: ['ChatList', 'ChatDetailsScreen'],
  Profile: ['Profile', 'Settings', 'LanguagePicker', 'EditProfile', 'ChangePassword', 'HelpSupport', 'NSSPortal'],
};

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

  const tabs = isCaregiver
    ? [
        { name: 'CaregiverDashboard', label: 'Home', icon: 'home', iconOutline: 'home-outline' },
        { name: 'ScheduleScreen2', label: 'Schedule', icon: 'calendar-clock', iconOutline: 'calendar-clock-outline' },
        { name: 'ChatList2', label: 'Messages', icon: 'message-text', iconOutline: 'message-text-outline' },
        { name: 'ProfileScreen2', label: 'Profile', icon: 'account-circle', iconOutline: 'account-circle-outline' },
      ]
    : [
        { name: 'CareRecipientDashboard', label: 'Home', icon: 'home', iconOutline: 'home-outline' },
        { name: 'NewRequestScreen', label: 'Request', icon: 'plus-circle', iconOutline: 'plus-circle-outline' },
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
                  size={28}
                  color={active ? colors.card : colors.textSecondary}
                />
              </View>
              <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
                {label}
              </Text>
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
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    justifyContent: 'space-around',
    alignItems: 'center',
    minHeight: 72,
    paddingBottom: Platform.OS === 'android' ? spacing.sm : spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    minHeight: accessibility.minTouchTargetSize + 4,
  },
  tabActive: {},
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  iconWrapActive: {
    backgroundColor: colors.primary,
  },
  tabPressed: {
    opacity: 0.8,
  },
  label: {
    fontSize: 12,
    fontWeight: typography.weightMedium,
    color: colors.textSecondary,
  },
  labelActive: {
    color: colors.primary,
    fontWeight: typography.weightSemiBold,
  },
});

export default BottomNav;
