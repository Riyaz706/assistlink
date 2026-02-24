/**
 * Profile Setup - PRD: Needs assessment questionnaire, accessibility preferences,
 * location, medical info, preferred communication.
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from './context/AuthContext';
import { useAccessibility } from './context/AccessibilityContext';
import { api } from './api/client';
import BottomNav from './BottomNav';
import { colors, typography, spacing } from './theme';

const QUESTIONS = [
  { id: 'mobility', label: 'Do you need mobility assistance?', key: 'mobility_needs' },
  { id: 'vision', label: 'Do you have visual impairment?', key: 'vision_needs' },
  { id: 'hearing', label: 'Do you have hearing impairment?', key: 'hearing_needs' },
  { id: 'cognitive', label: 'Do you need cognitive support?', key: 'cognitive_needs' },
  { id: 'medical', label: 'Any medical conditions we should know?', key: 'medical_info' },
  { id: 'preferred_comms', label: 'Preferred communication (text, call, in-person)', key: 'preferred_communication' },
];

export default function ProfileSetupScreen({ navigation }: any) {
  const { user, refreshUser } = useAuth();
  const { largeText, highContrast, setLargeText, setHighContrast } = useAccessibility();
  const [personalAddress, setPersonalAddress] = useState('');
  const [needs, setNeeds] = useState<Record<string, boolean>>({});
  const [medicalInfo, setMedicalInfo] = useState('');
  const [preferredComms, setPreferredComms] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExisting();
  }, []);

  const loadExisting = async () => {
    try {
      const profile: any = await api.getProfile();
      setPersonalAddress(profile?.address?.address || profile?.address?.formatted || '');
      setMedicalInfo(profile?.address?.medical_info || '');
      setPreferredComms(profile?.address?.preferred_communication || '');
      const existing = profile?.address?.care_needs_assessment || {};
      const parsed: Record<string, boolean> = {};
      Object.entries(existing).forEach(([k, v]) => {
        parsed[k] = v === true || v === 'Yes' || v === 'yes';
      });
      setNeeds(parsed);
    } catch (_) {}
    setLoading(false);
  };

  const updateNeed = (key: string, value: boolean) => {
    setNeeds((p) => ({ ...p, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const profile: any = await api.getProfile();
      const existingAddr = profile?.address && typeof profile.address === 'object' ? { ...profile.address } : {};
      const addr = {
        ...existingAddr,
        address: personalAddress || existingAddr.address,
        medical_info: medicalInfo,
        preferred_communication: preferredComms,
        care_needs_assessment: needs,
      };
      await api.updateProfile({ address: addr });
      if (refreshUser) await refreshUser();
      Alert.alert('Saved', 'Your needs assessment has been saved.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile Setup</Text>
        <View style={styles.backBtn} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Needs Assessment</Text>
        <View style={styles.card}>
          {QUESTIONS.slice(0, 4).map((q) => (
            <View key={q.id} style={styles.row}>
              <Text style={styles.questionLabel}>{q.label}</Text>
              <Switch
                value={needs[q.key] ?? false}
                onValueChange={(v) => updateNeed(q.key, v)}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Medical Information (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Diabetes, allergies, medications"
          placeholderTextColor={colors.textMuted}
          value={medicalInfo}
          onChangeText={setMedicalInfo}
          multiline
          numberOfLines={2}
        />

        <Text style={styles.sectionTitle}>Preferred Communication</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Text message, phone call, in-person"
          placeholderTextColor={colors.textMuted}
          value={preferredComms}
          onChangeText={setPreferredComms}
        />

        <Text style={styles.sectionTitle}>Location & Address</Text>
        <TextInput
          style={styles.input}
          placeholder="Your address for care visits"
          placeholderTextColor={colors.textMuted}
          value={personalAddress}
          onChangeText={setPersonalAddress}
        />

        <Text style={styles.sectionTitle}>Accessibility Preferences</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.questionLabel}>Large text</Text>
            <Switch value={largeText} onValueChange={setLargeText} trackColor={{ false: colors.border, true: colors.primary }} />
          </View>
          <View style={styles.row}>
            <Text style={styles.questionLabel}>High contrast</Text>
            <Switch value={highContrast} onValueChange={setHighContrast} trackColor={{ false: colors.border, true: colors.primary }} />
          </View>
        </View>

        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Save and continue</Text>}
        </TouchableOpacity>
        <View style={{ height: 100 }} />
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 48, height: 48, justifyContent: 'center' },
  headerTitle: { fontSize: typography.headingSmall, fontWeight: '600', color: colors.textPrimary },
  scroll: { padding: spacing.md, paddingBottom: 24 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 8, marginTop: spacing.lg },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  questionLabel: { flex: 1, fontSize: 16, color: colors.textPrimary },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.md, fontSize: 16, color: colors.textPrimary, marginBottom: spacing.md, minHeight: 48 },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: spacing.xl },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});
