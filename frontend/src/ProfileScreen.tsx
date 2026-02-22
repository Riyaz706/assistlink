import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Switch,
  StatusBar,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from './context/AuthContext';
import { api } from './api/client';
import { useFocusEffect } from '@react-navigation/native';
import { useErrorHandler } from './hooks/useErrorHandler';

// --- IMPORT BOTTOM NAV ---
// Make sure this path matches your project structure
import BottomNav from './BottomNav';

// --- THEME COLORS ---
const THEME = {
  bg: "#F5F7FA",        // Light Gray/White Background (Clean)
  card: "#FFFFFF",      // White Cards
  primary: "#059669",   // TARGET: Emerald Green
  text: "#1F2937",      // Dark Gray Text
  subText: "#6B7280",   // Lighter Gray
  danger: "#EF4444",    // TARGET: Red
  dangerBg: "#FEF2F2",  // Light Red for Logout Background
  iconBg: "#E0F2F1",    // Very Light Green for icon circles
  divider: "#E5E7EB"    // Light Gray Divider
};

export default function ProfileScreen({ navigation }: any) {
  // State for toggles
  const [pushEnabled, setPushEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const { user, logout, refreshUser } = useAuth();
  const { handleError, error, clearError } = useErrorHandler();

  // Load profile data when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      loadProfile();
      return () => clearError();
    }, [user])
  );

  const loadProfile = async () => {
    if (!user) return;
    setLoading(true);
    clearError();
    try {
      const profileData = await api.getProfile();
      setProfile(profileData);
    } catch (error) {
      handleError(error, 'profile-load');
    } finally {
      setLoading(false);
    }
  };

  const fullName = profile?.full_name || user?.full_name || 'User';
  const roleLabel =
    user?.role === 'caregiver'
      ? 'Caregiver'
      : user?.role === 'care_recipient'
        ? 'Care Recipient'
        : 'Member';

  // --- REUSABLE COMPONENT: Settings List Item ---
  const SettingsItem = ({ icon, iconColor, label, rightElement, onPress, isLast }: any) => (
    <TouchableOpacity
      style={[styles.itemContainer, isLast && { borderBottomWidth: 0 }]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      <View style={styles.itemLeft}>
        <View style={styles.iconBox}>
          <MaterialCommunityIcons name={icon} size={20} color={iconColor} />
        </View>
        <Text style={styles.itemLabel}>{label}</Text>
      </View>
      <View style={styles.itemRight}>
        {rightElement}
      </View>
    </TouchableOpacity>
  );

  // Re-define SettingsItem to fix the icon name bug in the original code if any, 
  // but looking at original, it passed 'icon' prop to name. 
  // Restoring original component logic but inside the function scope.

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={THEME.bg} />

      {/* --- HEADER --- */}
      <View style={styles.header}>
        <View style={{ width: 40 }} />
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={() => navigation.navigate('HelpSupport')}>
          <Text style={styles.helpText}>Help</Text>
        </TouchableOpacity>
      </View>

      {/* Error Banner */}
      {error && (
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle" size={20} color="#FFF" />
          <Text style={styles.errorText} numberOfLines={2}>
            {error.message || "An error occurred"}
          </Text>
          <TouchableOpacity onPress={clearError}>
            <MaterialCommunityIcons name="close" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* --- PROFILE INFO SECTION --- */}
        <View style={styles.profileSection}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={() => navigation.navigate('EditProfile')}
          >
            {(profile?.profile_photo_url || (user as any)?.profile_photo_url) ? (
              <Image
                source={{
                  uri: profile?.profile_photo_url || (user as any)?.profile_photo_url,
                }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <MaterialCommunityIcons name="account" size={40} color={THEME.subText} />
              </View>
            )}
            <View style={styles.editBadge}>
              <MaterialCommunityIcons name="pencil" size={14} color="#FFF" />
            </View>
          </TouchableOpacity>

          <Text style={styles.name}>{fullName}</Text>

          <View style={styles.roleContainer}>
            <MaterialCommunityIcons name="check-decagram" size={16} color={THEME.primary} style={{ marginRight: 4 }} />
            <Text style={styles.roleText}>{roleLabel}</Text>
          </View>

          <TouchableOpacity
            style={styles.editProfileBtn}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <Text style={styles.editProfileText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* --- ACCOUNT SECTION --- */}
        <Text style={styles.sectionHeader}>ACCOUNT</Text>
        <View style={styles.sectionCard}>
          <SettingsItem
            icon="account"
            iconColor={THEME.primary}
            label="Personal Information"
            rightElement={<MaterialCommunityIcons name="chevron-right" size={24} color={THEME.subText} />}
            onPress={() => navigation.navigate('EditProfile')}
          />
          <SettingsItem
            icon="lock"
            iconColor="#ca8a04"
            label="Change Password"
            rightElement={<MaterialCommunityIcons name="chevron-right" size={24} color={THEME.subText} />}
            isLast={true}
            onPress={() => navigation.navigate('ChangePassword')}
          />
        </View>

        {/* --- PREFERENCES SECTION --- */}
        <Text style={styles.sectionHeader}>PREFERENCES</Text>
        <View style={styles.sectionCard}>
          <SettingsItem
            icon="bell"
            iconColor="#7e22ce"
            label="Push Notifications"
            rightElement={
              <Switch
                value={pushEnabled}
                onValueChange={setPushEnabled}
                trackColor={{ false: "#9CA3AF", true: THEME.primary }}
                thumbColor={"#FFF"}
              />
            }
          />
          <SettingsItem
            icon="web"
            iconColor="#0e7490"
            label="Language"
            rightElement={
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.valueText}>English (US)</Text>
                <MaterialCommunityIcons name="chevron-right" size={24} color={THEME.subText} />
              </View>
            }
            isLast={true}
            onPress={() => Alert.alert('Language', 'English is the only supported language at this time.')}
          />
        </View>

        {/* --- SUPPORT SECTION --- */}
        <Text style={styles.sectionHeader}>SUPPORT</Text>
        <View style={styles.sectionCard}>
          <SettingsItem
            icon="help-circle"
            iconColor="#be123c"
            label="Help Center"
            rightElement={<MaterialCommunityIcons name="open-in-new" size={20} color={THEME.subText} />}
            onPress={() => navigation.navigate('HelpSupport')}
          />
          <SettingsItem
            icon="file-document"
            iconColor="#4b5563"
            label="Terms of Service"
            rightElement={<MaterialCommunityIcons name="chevron-right" size={24} color={THEME.subText} />}
            isLast={true}
            onPress={() => Linking.openURL('https://assistlink.app/terms').catch(() => Alert.alert('Error', 'Could not open Terms of Service.'))}
          />
        </View>

        {/* --- LOG OUT BUTTON --- */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={async () => {
            try {
              clearError();
              await logout();
            } catch (error) {
              handleError(error, 'logout');
            }
          }}
        >
          <MaterialCommunityIcons name="logout" size={20} color={THEME.danger} style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        {/* --- VERSION INFO --- */}
        <Text style={styles.versionText}>VERSION 1.0.0 (BUILD 302)</Text>

        {/* Spacer for BottomNav */}
        <View style={{ height: 100 }} />

      </ScrollView>

      {/* --- BOTTOM NAVIGATION --- */}
      <BottomNav />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.bg,
  },
  // Error Styles
  errorContainer: {
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 8,
  },
  errorText: {
    color: '#FFF',
    flex: 1,
    marginHorizontal: 8,
    fontSize: 13,
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: THEME.text,
  },
  helpText: {
    color: THEME.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  // Profile Top Section
  profileSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: THEME.card,
  },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: THEME.card,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: THEME.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: THEME.bg,
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: THEME.text,
    marginBottom: 4,
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  roleText: {
    color: THEME.subText,
    fontSize: 14,
  },
  editProfileBtn: {
    backgroundColor: THEME.card,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME.divider,
  },
  editProfileText: {
    color: THEME.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  // Sections
  sectionHeader: {
    color: THEME.subText,
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 10,
    marginLeft: 4,
    letterSpacing: 1,
  },
  sectionCard: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: THEME.divider,
    // Soft Shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 2,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME.divider,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: THEME.iconBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemLabel: {
    color: THEME.text,
    fontSize: 16,
    fontWeight: '500',
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  valueText: {
    color: THEME.subText,
    fontSize: 14,
    marginRight: 8,
  },
  // Logout - RED THEMED
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.dangerBg, // Light Red Background
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: THEME.danger, // Red Border
  },
  logoutText: {
    color: THEME.danger, // Red Text
    fontSize: 16,
    fontWeight: 'bold',
  },
  versionText: {
    textAlign: 'center',
    color: THEME.subText,
    fontSize: 11,
    letterSpacing: 0.5,
  },
});