/**
 * NSS Portal Screen - PRD: Menu item "NSS Portal"
 * Links users to the National Service Scheme (NSS) portal for volunteer info and resources.
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, typography, spacing } from './theme';
import BottomNav from './BottomNav';

const NSS_PORTAL_URL = 'https://nss.gov.in';

const NSSPortalScreen = ({ navigation }: any) => {
  const openPortal = () => {
    Linking.openURL(NSS_PORTAL_URL).catch(() =>
      Alert.alert('Error', 'Could not open NSS Portal. Please try again later.')
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.contentWrap}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Icon name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>NSS Portal</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.iconWrap}>
            <Icon name="school" size={48} color={colors.primary} />
          </View>
          <Text style={styles.heroTitle}>National Service Scheme</Text>
          <Text style={styles.heroSubtitle}>
            Connect with the official NSS portal for volunteer programs, events, and resources.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>About NSS</Text>
          <Text style={styles.cardBody}>
            The National Service Scheme (NSS) is a central sector scheme that provides opportunities for students to take part in community service. Many AssistLink caregivers are NSS volunteers, bringing trained support to exam assistance and elderly care.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={openPortal}
          activeOpacity={0.8}
          accessibilityLabel="Open NSS Portal in browser"
          accessibilityRole="button"
        >
          <Icon name="open-in-new" size={22} color="#fff" style={styles.btnIcon} />
          <Text style={styles.primaryBtnText}>Open NSS Portal</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>
          You will be taken to the official NSS website in your browser.
        </Text>
        <View style={{ height: 100 }} />
      </ScrollView>
      </View>

      <BottomNav />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  contentWrap: { flex: 1 },
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
  backBtn: { width: 48, height: 48, justifyContent: 'center', alignItems: 'center' },
  headerTitle: {
    fontSize: typography.headingSmall,
    fontWeight: typography.weightSemiBold,
    color: colors.textPrimary,
  },
  scroll: { padding: spacing.md, paddingBottom: 24 },
  hero: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroTitle: {
    fontSize: typography.headingMedium,
    fontWeight: typography.weightSemiBold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  heroSubtitle: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: spacing.sm,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  cardTitle: {
    fontSize: typography.body,
    fontWeight: typography.weightSemiBold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  cardBody: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: spacing.lg,
  },
  btnIcon: { marginRight: spacing.sm },
  primaryBtnText: {
    color: colors.card,
    fontSize: typography.body,
    fontWeight: typography.weightSemiBold,
  },
  footer: {
    marginTop: spacing.md,
    fontSize: typography.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
  },
});

export default NSSPortalScreen;
