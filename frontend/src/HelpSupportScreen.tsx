/**
 * Help & Support Screen - PRD: FAQ, Contact support form,
 * Video tutorials, User manual, Feedback submission, App version, Terms link.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StatusBar,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, typography, spacing, accessibility as a11y } from './theme';
import Constants from 'expo-constants';
import BottomNav from './BottomNav';
import { api } from './api/client';

const FAQ_ITEMS = [
  { q: 'How do I request a caregiver?', a: 'Go to Home → Request New Care, choose service type, date/time, and submit. You can also use the Requests tab to view available caregivers first.' },
  { q: 'How do I book exam assistance?', a: 'Select "Exam Assistance" when creating a request. Add exam details, venue, and any accommodations needed. A caregiver will be matched based on availability.' },
  { q: 'How do I use the emergency button?', a: 'Swipe the red SOS bar on the dashboard or open Emergency from the menu. Your location and alert are sent to your emergency contact and support.' },
  { q: 'How do I chat with my caregiver?', a: 'Open the Messages tab, select the caregiver conversation, and send text or use the video call button for a quick call.' },
];

const HelpSupportScreen = ({ navigation }: any) => {
  const [feedback, setFeedback] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  const sendFeedback = async () => {
    if (!feedback.trim()) return;
    try {
      setSubmitting(true);
      await api.submitAppFeedback(feedback);
      Alert.alert('Thank you', 'Your feedback has been submitted.');
      setFeedback('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const sendContact = async () => {
    if (!contactEmail.trim() || !contactMessage.trim()) return;
    try {
      setSubmitting(true);
      await api.contactSupport({ email: contactEmail, message: contactMessage });
      Alert.alert('Message sent', 'We will get back to you soon.');
      setContactEmail('');
      setContactMessage('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send message');
    } finally {
      setSubmitting(false);
    }
  };

  const Item = ({ icon, label, onPress, hint }: { icon: string; label: string; onPress: () => void; hint?: string }) => (
    <TouchableOpacity
      style={styles.linkItem}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityHint={hint}
    >
      <Icon name={icon as any} size={22} color={colors.primary} style={styles.linkIcon} accessibilityElementsHidden />
      <Text style={styles.linkLabel}>{label}</Text>
      <Icon name="chevron-right" size={24} color={colors.textSecondary} accessibilityElementsHidden />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          accessibilityHint="Returns to the previous screen"
        >
          <Icon name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} accessibilityRole="header">Help & Support</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionTitle}>FAQ</Text>
        <View style={styles.card}>
          {FAQ_ITEMS.map((faq, i) => (
            <View key={i} style={[styles.faqItem, i < FAQ_ITEMS.length - 1 && styles.faqBorder]}>
              <Text style={styles.faqQ}>{faq.q}</Text>
              <Text style={styles.faqA}>{faq.a}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>RESOURCES</Text>
        <View style={styles.card}>
          <Item
            icon="play-circle"
            label="Video tutorials"
            onPress={() => Linking.openURL('https://assistlink.app/help/tutorials').catch(() => Alert.alert('Error', 'Could not open tutorials.'))}
            hint="Opens video tutorials"
          />
          <Item
            icon="book-open-variant"
            label="User manual"
            onPress={() => Linking.openURL('https://assistlink.app/help/manual').catch(() => Alert.alert('Error', 'Could not open user manual.'))}
            hint="Opens user manual"
          />
          <Item
            icon="file-document-outline"
            label="Terms of Service"
            onPress={() => {
              const termsUrl = 'https://assistlink.app/terms';
              Linking.openURL(termsUrl).catch(() => Alert.alert('Error', 'Could not open Terms of Service.'));
            }}
            hint="Opens Terms of Service in browser"
          />
        </View>

        <Text style={styles.sectionTitle}>CONTACT SUPPORT</Text>
        <View style={styles.card}>
          <TextInput
            style={styles.input}
            placeholder="Your email"
            placeholderTextColor={colors.textMuted}
            value={contactEmail}
            onChangeText={setContactEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            accessibilityLabel="Your email"
            accessibilityHint="Email address for support to reply"
          />
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder="Your message"
            placeholderTextColor={colors.textMuted}
            value={contactMessage}
            onChangeText={setContactMessage}
            multiline
            numberOfLines={4}
            accessibilityLabel="Your message"
            accessibilityHint="Describe your issue or question"
          />
          <TouchableOpacity
            style={[styles.primaryBtn, submitting && { opacity: 0.7 }]}
            onPress={sendContact}
            disabled={submitting}
            accessibilityLabel="Send message"
            accessibilityRole="button"
            accessibilityHint="Sends your message to support"
            accessibilityState={{ disabled: submitting, busy: submitting }}
          >
            {submitting ? (
              <ActivityIndicator color={colors.card} size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>Send message</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>FEEDBACK</Text>
        <View style={styles.card}>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder="Share your feedback or suggestions"
            placeholderTextColor={colors.textMuted}
            value={feedback}
            onChangeText={setFeedback}
            multiline
            numberOfLines={3}
            accessibilityLabel="Feedback"
            accessibilityHint="Share your feedback or suggestions"
          />
          <TouchableOpacity
            style={[styles.primaryBtn, submitting && { opacity: 0.7 }]}
            onPress={sendFeedback}
            disabled={submitting}
            accessibilityLabel="Submit feedback"
            accessibilityRole="button"
            accessibilityHint="Submits your feedback to the team"
            accessibilityState={{ disabled: submitting, busy: submitting }}
          >
            {submitting ? (
              <ActivityIndicator color={colors.card} size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>Submit feedback</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>AssistLink v{appVersion}</Text>
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
    padding: spacing.md,
  },
  faqItem: { paddingVertical: spacing.sm },
  faqBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  faqQ: { fontSize: typography.body, fontWeight: typography.weightSemiBold, color: colors.textPrimary, marginBottom: 4 },
  faqA: { fontSize: typography.bodySmall, color: colors.textSecondary, lineHeight: 20 },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: a11y.minTouchTargetSize,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  linkIcon: { marginRight: spacing.md },
  linkLabel: { flex: 1, fontSize: typography.body, color: colors.textPrimary },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: typography.body,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    minHeight: a11y.minTouchTargetSize,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    minHeight: a11y.minTouchTargetSize,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: colors.card, fontSize: typography.body, fontWeight: typography.weightSemiBold },
  version: {
    textAlign: 'center',
    marginTop: spacing.xl,
    fontSize: typography.bodySmall,
    color: colors.textMuted,
  },
});

export default HelpSupportScreen;
