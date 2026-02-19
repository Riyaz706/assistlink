/**
 * Settings Screen - PRD: Profile editing, Notification preferences,
 * Accessibility settings, Privacy controls, Language, Permissions, Account deletion, Help link.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from './context/AuthContext';
import { useAccessibility } from './context/AccessibilityContext';
import { colors, typography, spacing } from './theme';
import BottomNav from './BottomNav';

const SettingsScreen = ({ navigation }: any) => {
  const { logout } = useAuth();
  const { largeText, highContrast, setLargeText, setHighContrast } = useAccessibility();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const Item = ({
    icon,
    iconColor,
    label,
    onPress,
    right,
    isLast,
  }: {
    icon: string;
    iconColor: string;
    label: string;
    onPress?: () => void;
    right?: React.ReactNode;
    isLast?: boolean;
  }) => (
    <TouchableOpacity
      style={[styles.item, !isLast && styles.itemBorder]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.itemLeft}>
        <View style={[styles.iconWrap, { backgroundColor: iconColor + '20' }]}>
          <Icon name={icon as any} size={22} color={iconColor} />
        </View>
        <Text style={[styles.itemLabel, largeText && styles.itemLabelLarge]}>{label}</Text>
      </View>
      {right ?? (onPress ? <Icon name="chevron-right" size={24} color={colors.textSecondary} /> : null)}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>ACCOUNT</Text>
        <View style={styles.card}>
          <Item
            icon="account-edit"
            iconColor={colors.primary}
            label="Profile & Personal Information"
            onPress={() => navigation.navigate('EditProfile')}
            isLast={false}
          />
          <Item
            icon="lock"
            iconColor={colors.accent}
            label="Change Password"
            onPress={() => navigation.navigate('ChangePassword')}
            isLast={true}
          />
        </View>

        <Text style={styles.sectionTitle}>PREFERENCES</Text>
        <View style={styles.card}>
          <Item
            icon="bell"
            iconColor={colors.secondary}
            label="Push Notifications"
            right={
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: colors.border, true: colors.secondary }}
                thumbColor={colors.card}
              />
            }
            isLast={false}
          />
          <Item
            icon="format-size"
            iconColor={colors.primary}
            label="Large Text (Accessibility)"
            right={
              <Switch
                value={largeText}
                onValueChange={setLargeText}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.card}
              />
            }
            isLast={false}
          />
          <Item
            icon="contrast"
            iconColor={colors.textPrimary}
            label="High Contrast"
            right={
              <Switch
                value={highContrast}
                onValueChange={setHighContrast}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.card}
              />
            }
            isLast={false}
          />
          <Item
            icon="web"
            iconColor={colors.secondary}
            label="Language"
            right={
              <View style={styles.valueRow}>
                <Text style={styles.valueText}>English</Text>
                <Icon name="chevron-right" size={24} color={colors.textSecondary} />
              </View>
            }
            onPress={() => { }}
            isLast={true}
          />
        </View>

        <Text style={styles.sectionTitle}>SUPPORT</Text>
        <View style={styles.card}>
          <Item
            icon="help-circle"
            iconColor={colors.accent}
            label="Help & Support"
            onPress={() => navigation.navigate('HelpSupport')}
            isLast={false}
          />
          <Item
            icon="file-document-outline"
            iconColor={colors.textSecondary}
            label="Terms of Service"
            onPress={() => { }}
            isLast={true}
          />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <BottomNav />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 48, height: 48, justifyContent: 'center' },
  headerTitle: {
    fontSize: typography.headingSmall,
    fontWeight: typography.weightSemiBold,
    color: colors.textPrimary,
  },
  scroll: { padding: spacing.md, paddingBottom: 24 },
  sectionTitle: {
    fontSize: typography.bodySmall,
    fontWeight: typography.weightSemiBold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
    marginLeft: 4,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: 52,
  },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  itemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  itemLabel: { fontSize: typography.body, color: colors.textPrimary },
  itemLabelLarge: { fontSize: 18 },
  valueRow: { flexDirection: 'row', alignItems: 'center' },
  valueText: { fontSize: typography.body, color: colors.textSecondary, marginRight: 4 },
});

export default SettingsScreen;
