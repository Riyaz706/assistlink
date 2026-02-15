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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, typography, spacing } from './theme';
import Constants from 'expo-constants';
import BottomNav from './BottomNav';

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
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  const sendFeedback = () => {
    if (!feedback.trim()) return;
    Alert.alert('Thank you', 'Your feedback has been submitted.');
    setFeedback('');
  };

  const sendContact = () => {
    if (!contactEmail.trim() || !contactMessage.trim()) return;
    Alert.alert('Message sent', 'We will get back to you soon.');
    setContactEmail('');
    setContactMessage('');
  };

  const Item = ({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) => (
    <TouchableOpacity style={styles.linkItem} onPress={onPress} activeOpacity={0.7}>
      <Icon name={icon} size={22} color={colors.primary} style={styles.linkIcon} />
      <Text style={styles.linkLabel}>{label}</Text>
      <Icon name="chevron-right" size={24} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
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
          <Item icon="play-circle" label="Video tutorials" onPress={() => {}} />
          <Item icon="book-open-variant" label="User manual" onPress={() => {}} />
          <Item icon="file-document-outline" label="Terms of Service" onPress={() => Linking.openURL('https://example.com/terms')} />
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
          />
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder="Your message"
            placeholderTextColor={colors.textMuted}
            value={contactMessage}
            onChangeText={setContactMessage}
            multiline
            numberOfLines={4}
          />
          <TouchableOpacity style={styles.primaryBtn} onPress={sendContact}>
            <Text style={styles.primaryBtnText}>Send message</Text>
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
          />
          <TouchableOpacity style={styles.primaryBtn} onPress={sendFeedback}>
            <Text style={styles.primaryBtnText}>Submit feedback</Text>
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
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
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
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
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
