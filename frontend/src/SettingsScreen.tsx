/**
 * Settings Screen - PRD: Profile editing, Notification preferences,
 * Accessibility settings, Privacy controls, Language, Permissions, Account deletion, Help link.
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  StatusBar,
  Alert,
  Linking,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import { colors as defaultColors, typography, spacing } from './theme';
import BottomNav from './BottomNav';
import { apiConfigReady, getCurrentApiBaseUrl, getDefaultApiUrl, setApiBaseUrlOverride, checkBackendConnection } from './api/client';
import * as Camera from 'expo-camera';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';
import { invalidateCache } from './lib/apiCache';
import * as SecureStore from 'expo-secure-store';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, getStoredLanguage, type LanguageCode } from './i18n';

const NOTIFICATIONS_PREF_KEY = 'assistlink_notifications_enabled';
const PRIVACY_PROFILE_VISIBLE_KEY = 'assistlink_privacy_profile_visible';
const PRIVACY_SHARE_LOCATION_KEY = 'assistlink_privacy_share_location';

const SettingsScreen = ({ navigation }: any) => {
  const { logout } = useAuth();
  const { t } = useTranslation();
  const { colors, largeText, highContrast, setLargeText, setHighContrast } = useTheme();
  const [currentLang, setCurrentLang] = useState<LanguageCode>('en');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notificationsLoaded, setNotificationsLoaded] = useState(false);
  const [backendUrl, setBackendUrl] = useState('');
  const [backendUrlLoaded, setBackendUrlLoaded] = useState(false);
  const [savingUrl, setSavingUrl] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [profileVisible, setProfileVisible] = useState(true);
  const [shareLocation, setShareLocation] = useState(true);
  const [privacyLoaded, setPrivacyLoaded] = useState(false);
  const [permissions, setPermissions] = useState<{
    camera?: string;
    microphone?: string;
    location?: string;
    notifications?: string;
  }>({});

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(NOTIFICATIONS_PREF_KEY);
        if (stored !== null) setNotificationsEnabled(stored === 'true');
      } catch (e) {
        console.warn('Failed to load notifications preference', e);
      } finally {
        setNotificationsLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      await apiConfigReady;
      setBackendUrl(getCurrentApiBaseUrl());
      setBackendUrlLoaded(true);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const pv = await AsyncStorage.getItem(PRIVACY_PROFILE_VISIBLE_KEY);
        const sl = await AsyncStorage.getItem(PRIVACY_SHARE_LOCATION_KEY);
        if (pv !== null) setProfileVisible(pv === 'true');
        if (sl !== null) setShareLocation(sl === 'true');
      } catch {
        // use defaults
      } finally {
        setPrivacyLoaded(true);
      }
    })();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      getStoredLanguage().then(setCurrentLang);
    }, [])
  );

  useEffect(() => {
    (async () => {
      try {
        const [cam, mic, loc, notif] = await Promise.all([
          Camera.getCameraPermissionsAsync().then(p => p.status),
          Audio.getPermissionsAsync().then(p => p.status),
          Location.getForegroundPermissionsAsync().then(p => p.status),
          Notifications.getPermissionsAsync().then(p => p.status),
        ]);
        setPermissions({ camera: cam, microphone: mic, location: loc, notifications: notif });
      } catch {
        setPermissions({});
      }
    })();
  }, []);

  const setProfileVisibleAndPersist = async (value: boolean) => {
    setProfileVisible(value);
    try {
      await AsyncStorage.setItem(PRIVACY_PROFILE_VISIBLE_KEY, String(value));
    } catch (e) {
      console.warn('Failed to save profile visibility', e);
    }
  };
  const setShareLocationAndPersist = async (value: boolean) => {
    setShareLocation(value);
    try {
      await AsyncStorage.setItem(PRIVACY_SHARE_LOCATION_KEY, String(value));
    } catch (e) {
      console.warn('Failed to save share location', e);
    }
  };
  const setNotificationsEnabledAndPersist = async (value: boolean) => {
    setNotificationsEnabled(value);
    try {
      await AsyncStorage.setItem(NOTIFICATIONS_PREF_KEY, String(value));
    } catch (e) {
      console.warn('Failed to save notifications preference', e);
    }
  };

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
      style={[styles.item, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
      accessibilityLabel={label}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <View style={styles.itemLeft}>
        <View style={[styles.iconWrap, { backgroundColor: iconColor + '20' }]}>
          <Icon name={icon as any} size={22} color={iconColor} />
        </View>
        <Text style={[styles.itemLabel, { color: colors.textPrimary }, largeText && styles.itemLabelLarge]}>{label}</Text>
      </View>
      {right ?? (onPress ? <Icon name="chevron-right" size={24} color={colors.textSecondary} /> : null)}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Go back" accessibilityRole="button">
          <Icon name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Settings</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ACCOUNT</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
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

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>PREFERENCES</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Item
            icon="bell"
            iconColor={colors.secondary}
            label="Push Notifications"
            right={
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabledAndPersist}
                trackColor={{ false: colors.border, true: colors.secondary }}
                thumbColor={colors.card}
                accessibilityLabel="Toggle push notifications"
                accessibilityRole="switch"
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
                accessibilityLabel="Large text"
                accessibilityRole="switch"
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
                accessibilityLabel="High contrast"
                accessibilityRole="switch"
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
                <Text style={[styles.valueText, { color: colors.textSecondary }]}>
                  {LANGUAGES.find(l => l.code === currentLang)?.native ?? 'English'}
                </Text>
                <Icon name="chevron-right" size={24} color={colors.textSecondary} />
              </View>
            }
            onPress={() => navigation.navigate('LanguagePicker')}
            isLast={true}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>PRIVACY</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Item
            icon="account-eye"
            iconColor={colors.primary}
            label="Profile visible to caregivers"
            right={
              privacyLoaded ? (
                <Switch
                  value={profileVisible}
                  onValueChange={setProfileVisibleAndPersist}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.card}
                  accessibilityLabel="Profile visibility"
                  accessibilityRole="switch"
                />
              ) : null
            }
            isLast={false}
          />
          <Item
            icon="map-marker"
            iconColor={colors.secondary}
            label="Share location with caregivers"
            right={
              privacyLoaded ? (
                <Switch
                  value={shareLocation}
                  onValueChange={setShareLocationAndPersist}
                  trackColor={{ false: colors.border, true: colors.secondary }}
                  thumbColor={colors.card}
                  accessibilityLabel="Share location"
                  accessibilityRole="switch"
                />
              ) : null
            }
            isLast={true}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>APP PERMISSIONS</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.permRow}>
            <Icon name="camera" size={22} color={colors.primary} />
            <Text style={[styles.permLabel, { color: colors.textPrimary }]}>Camera</Text>
            <View style={[styles.permBadge, { backgroundColor: permissions.camera === 'granted' ? '#059669' : '#F59E0B' }]}>
              <Text style={styles.permBadgeText}>{permissions.camera === 'granted' ? 'Allowed' : permissions.camera === 'denied' ? 'Denied' : 'Ask'}</Text>
            </View>
          </View>
          <View style={styles.permRow}>
            <Icon name="microphone" size={22} color={colors.primary} />
            <Text style={[styles.permLabel, { color: colors.textPrimary }]}>Microphone</Text>
            <View style={[styles.permBadge, { backgroundColor: permissions.microphone === 'granted' ? '#059669' : '#F59E0B' }]}>
              <Text style={styles.permBadgeText}>{permissions.microphone === 'granted' ? 'Allowed' : permissions.microphone === 'denied' ? 'Denied' : 'Ask'}</Text>
            </View>
          </View>
          <View style={styles.permRow}>
            <Icon name="map-marker" size={22} color={colors.primary} />
            <Text style={[styles.permLabel, { color: colors.textPrimary }]}>Location</Text>
            <View style={[styles.permBadge, { backgroundColor: permissions.location === 'granted' ? '#059669' : '#F59E0B' }]}>
              <Text style={styles.permBadgeText}>{permissions.location === 'granted' ? 'Allowed' : permissions.location === 'denied' ? 'Denied' : 'Ask'}</Text>
            </View>
          </View>
          <View style={styles.permRow}>
            <Icon name="bell" size={22} color={colors.primary} />
            <Text style={[styles.permLabel, { color: colors.textPrimary }]}>Notifications</Text>
            <View style={[styles.permBadge, { backgroundColor: permissions.notifications === 'granted' ? '#059669' : '#F59E0B' }]}>
              <Text style={styles.permBadgeText}>{permissions.notifications === 'granted' ? 'Allowed' : permissions.notifications === 'denied' ? 'Denied' : 'Ask'}</Text>
            </View>
          </View>
          {Platform.OS !== 'web' && (
            <TouchableOpacity
              style={[styles.permButton, { backgroundColor: colors.primary }]}
              onPress={() => Linking.openSettings()}
              accessibilityLabel="Open app settings"
              accessibilityRole="button"
            >
              <Icon name="cog" size={20} color="#fff" />
              <Text style={styles.permButtonText}>Open App Settings</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>CONNECTION</Text>
        <View style={[styles.card, { backgroundColor: colors.card, padding: spacing.md }]}>
          <Text style={[styles.itemLabel, { color: colors.textSecondary, marginBottom: 6 }]}>
            Backend URL
          </Text>
          {backendUrlLoaded ? (
            <>
              <TextInput
                style={[styles.urlInput, { color: colors.textPrimary, borderColor: colors.border }]}
                value={backendUrl}
                onChangeText={setBackendUrl}
                placeholder="https://assistlink-backend-1qjd.onrender.com"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                editable={!savingUrl}
              />
              <View style={styles.urlButtons}>
                <TouchableOpacity
                  style={[styles.urlButton, { backgroundColor: colors.primary }]}
                  onPress={async () => {
                    const u = backendUrl.trim().replace(/\/$/, '');
                    if (!u) {
                      Alert.alert('Error', 'Please enter a URL (e.g. https://assistlink-backend-1qjd.onrender.com)');
                      return;
                    }
                    setSavingUrl(true);
                    try {
                      await setApiBaseUrlOverride(u);
                      Alert.alert('Saved', 'Backend URL updated. New requests will use this address.');
                    } catch (e) {
                      Alert.alert('Error', 'Could not save URL.');
                    } finally {
                      setSavingUrl(false);
                    }
                  }}
                  disabled={savingUrl}
                >
                  {savingUrl ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.urlButtonText}>Save URL</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.urlButton, { backgroundColor: colors.textSecondary }]}
                  onPress={async () => {
                    setSavingUrl(true);
                    try {
                      await setApiBaseUrlOverride(null);
                      setBackendUrl(getDefaultApiUrl());
                      Alert.alert('Done', 'Using default backend URL from app settings.');
                    } catch (e) {
                      Alert.alert('Error', 'Could not reset.');
                    } finally {
                      setSavingUrl(false);
                    }
                  }}
                  disabled={savingUrl}
                >
                  <Text style={styles.urlButtonText}>Use default</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.urlButton, { backgroundColor: colors.accent }]}
                  onPress={async () => {
                    const urlToTest = backendUrl.trim().replace(/\/$/, '') || getCurrentApiBaseUrl();
                    if (!urlToTest.startsWith('http')) {
                      Alert.alert('Invalid URL', 'Enter a full URL (e.g. https://assistlink-backend-1qjd.onrender.com) first.');
                      return;
                    }
                    setTestingConnection(true);
                    try {
                      const result = await checkBackendConnection(urlToTest);
                      if (result.ok) {
                        Alert.alert('Connection OK', result.message || 'Backend is reachable. App and backend are connected.');
                      } else {
                        Alert.alert('Connection failed', result.message || 'Could not reach backend.');
                      }
                    } catch (e) {
                      Alert.alert('Error', (e as Error)?.message || 'Check failed.');
                    } finally {
                      setTestingConnection(false);
                    }
                  }}
                  disabled={testingConnection}
                >
                  {testingConnection ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.urlButtonText}>Test connection</Text>}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 8 }} />
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>CACHE & BIOMETRICS</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Item
            icon="database-off"
            iconColor={colors.textSecondary}
            label="Clear cached data"
            onPress={async () => {
              try {
                await invalidateCache();
                Alert.alert('Done', 'Cached data cleared. Fresh data will load on next visit.');
              } catch (e) {
                Alert.alert('Error', 'Could not clear cache.');
              }
            }}
            isLast={Platform.OS === 'web'}
          />
          {Platform.OS !== 'web' && (
            <Item
              icon="fingerprint-off"
              iconColor={colors.textSecondary}
              label="Disable biometric sign-in"
              onPress={async () => {
                try {
                  await SecureStore.deleteItemAsync('assistlink_biometric_refresh');
                  Alert.alert('Done', 'Biometric sign-in disabled. You will need to sign in with password next time.');
                } catch (e) {
                  Alert.alert('Error', 'Could not disable biometrics.');
                }
              }}
              isLast={true}
            />
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>DANGER ZONE</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Item
            icon="account-remove"
            iconColor={colors.error}
            label="Delete account"
            onPress={() => {
              Alert.alert(
                'Delete account',
                'This action cannot be undone. All your data will be permanently deleted. Are you sure?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await api.deleteAccount();
                        await logout();
                      } catch (e: any) {
                        Alert.alert('Error', e?.message || 'Could not delete account.');
                      }
                    },
                  },
                ]
              );
            }}
            isLast={true}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>SUPPORT</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
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
            onPress={() => Linking.openURL('https://assistlink.app/terms').catch(() => Alert.alert('Error', 'Could not open Terms of Service.'))}
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
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  backBtn: { width: 48, height: 48, justifyContent: 'center' },
  headerTitle: {
    fontSize: typography.headingSmall,
    fontWeight: typography.weightSemiBold,
  },
  scroll: { padding: spacing.md, paddingBottom: 24 },
  sectionTitle: {
    fontSize: typography.bodySmall,
    fontWeight: typography.weightSemiBold,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
    marginLeft: 4,
  },
  card: {
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
  itemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  itemLabel: { fontSize: typography.body },
  itemLabelLarge: { fontSize: 18 },
  valueRow: { flexDirection: 'row', alignItems: 'center' },
  valueText: { fontSize: typography.body, marginRight: 4 },
  urlInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: typography.body,
  },
  urlButtons: { flexDirection: 'row', marginTop: 12 },
  urlButton: {
    marginRight: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  urlButtonText: { color: '#fff', fontWeight: '600', fontSize: typography.body },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  permLabel: { flex: 1, fontSize: 16, marginLeft: 12 },
  permHint: { fontSize: 12, marginLeft: 8 },
  permBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  permBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  permButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    paddingVertical: 12,
    borderRadius: 12,
  },
  permButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

export default SettingsScreen;
