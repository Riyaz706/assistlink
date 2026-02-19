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
  Modal,
  FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from './context/AuthContext';
import { api } from './api/client';
import { useFocusEffect } from '@react-navigation/native';

import { useErrorHandler } from './hooks/useErrorHandler';

// --- THEME COLORS ---
const THEME = {
  bg: "#F5F7FA",
  card: "#FFFFFF",
  primary: "#059669",
  text: "#1F2937",
  subText: "#6B7280",
  danger: "#EF4444",
  dangerBg: "#FEF2F2",
  iconBg: "#E0F2F1",
  divider: "#E5E7EB",
  error: "#EF4444",
  errorBg: "#FEF2F2"
};

export default function ProfileScreen2({ navigation }: any) {
  const [availabilityStatus, setAvailabilityStatus] = useState('available');
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [caregiverProfileData, setCaregiverProfileData] = useState<any>(null);
  const [isQualModalVisible, setIsQualModalVisible] = useState(false);
  const { user, logout, refreshUser } = useAuth();

  const { handleError, error, clearError } = useErrorHandler();

  const fullName = profile?.full_name || user?.full_name || 'Caregiver';

  // Fetch status on focus
  useFocusEffect(
    React.useCallback(() => {
      loadAvailabilityStatus();
      return () => clearError();
    }, [])
  );

  const loadAvailabilityStatus = async () => {
    try {
      clearError();
      const profile: any = await api.getCaregiverProfile();
      setCaregiverProfileData(profile);
      if (profile?.availability_status) {
        setAvailabilityStatus(profile.availability_status);
      }
    } catch (e) {
      handleError(e, 'load-profile-status');
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setLoadingAvailability(true);
    try {
      clearError();
      const updatedProfile: any = await api.updateCaregiverProfile({ availability_status: newStatus });
      setAvailabilityStatus(updatedProfile.availability_status);
      setCaregiverProfileData(updatedProfile);
    } catch (e) {
      handleError(e, 'update-status');
    } finally {
      setLoadingAvailability(false);
    }
  };

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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={THEME.bg} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, marginLeft: -8 }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={THEME.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity>
          <Text style={styles.helpText}>Help</Text>
        </TouchableOpacity>
      </View>

      {/* ERROR BANNER */}
      {error && (
        <View style={styles.errorBanner}>
          <MaterialCommunityIcons name="alert-circle" size={20} color={THEME.error} />
          <Text style={styles.errorText}>{error.message}</Text>
          <TouchableOpacity onPress={clearError}>
            <MaterialCommunityIcons name="close" size={20} color={THEME.error} />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <View style={styles.profileSection}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={() => navigation.navigate('EditProfile')}
          >
            {(user as any)?.profile_photo_url ? (
              <Image source={{ uri: (user as any).profile_photo_url }} style={styles.avatar} />
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
            <Text style={styles.roleText}>Verified Caregiver</Text>
          </View>

          <TouchableOpacity style={styles.editProfileBtn} onPress={() => navigation.navigate('EditProfile')}>
            <Text style={styles.editProfileText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionHeader}>AVAILABILITY</Text>
        <View style={styles.sectionCard}>
          <View style={{ padding: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontWeight: '600', color: THEME.text }}>Current Status</Text>
              {loadingAvailability && <ActivityIndicator size="small" color={THEME.primary} />}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={[
                  styles.availabilityBtn,
                  availabilityStatus === 'available' && { backgroundColor: THEME.primary, borderColor: THEME.primary },
                  availabilityStatus === 'available' && styles.availabilityBtnActive
                ]}
                onPress={() => handleStatusChange('available')}
              >
                <Text style={[
                  styles.availabilityBtnText,
                  availabilityStatus === 'available' && styles.availabilityBtnTextActive
                ]}>Available</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.availabilityBtn,
                  availabilityStatus === 'busy' && { backgroundColor: '#F59E0B', borderColor: '#F59E0B' },
                  availabilityStatus === 'busy' && styles.availabilityBtnActive
                ]}
                onPress={() => handleStatusChange('busy')}
              >
                <Text style={[
                  styles.availabilityBtnText,
                  availabilityStatus === 'busy' && styles.availabilityBtnTextActive
                ]}>Busy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.availabilityBtn,
                  availabilityStatus === 'unavailable' && { backgroundColor: '#6B7280', borderColor: '#6B7280' },
                  availabilityStatus === 'unavailable' && styles.availabilityBtnActive
                ]}
                onPress={() => handleStatusChange('unavailable')}
              >
                <Text style={[
                  styles.availabilityBtnText,
                  availabilityStatus === 'unavailable' && styles.availabilityBtnTextActive
                ]}>Unavailable</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <Text style={styles.sectionHeader}>ACCOUNT</Text>
        <View style={styles.sectionCard}>
          <SettingsItem
            icon="account" iconColor={THEME.primary} label="Personal Information"
            rightElement={<MaterialCommunityIcons name="chevron-right" size={24} color={THEME.subText} />}
            onPress={() => navigation.navigate('EditProfile')}
          />
          <SettingsItem
            icon="medical-bag" iconColor="#48BB78" label="Qualifications"
            rightElement={<MaterialCommunityIcons name="chevron-right" size={24} color={THEME.subText} />}
            onPress={() => setIsQualModalVisible(true)}
          />
          <SettingsItem
            icon="lock" iconColor="#ED8936" label="Change Password"
            rightElement={<MaterialCommunityIcons name="chevron-right" size={24} color={THEME.subText} />}
            isLast={true}
            onPress={() => navigation.navigate('ChangePassword')}
          />
        </View>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={async () => {
            try {
              await logout();
            } catch (error) {
              console.error("Logout error:", error);
            }
          }}
        >
          <MaterialCommunityIcons name="logout" size={20} color={THEME.danger} style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>VERSION 2.4.0 (BUILD 302)</Text>
        <View style={{ height: 80 }} />

      </ScrollView>

      {/* Qualifications Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isQualModalVisible}
        onRequestClose={() => setIsQualModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Qualifications</Text>
              <TouchableOpacity onPress={() => setIsQualModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color={THEME.text} />
              </TouchableOpacity>
            </View>

            {!caregiverProfileData?.qualifications || caregiverProfileData.qualifications.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="certificate-outline" size={48} color={THEME.subText} />
                <Text style={styles.emptyText}>No qualifications listed yet.</Text>
                <TouchableOpacity
                  style={styles.addQualBtn}
                  onPress={() => {
                    setIsQualModalVisible(false);
                    navigation.navigate('EditProfile');
                  }}
                >
                  <Text style={styles.addQualBtnText}>Add Qualifications</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={caregiverProfileData.qualifications}
                keyExtractor={(item, index) => index.toString()}
                renderItem={({ item }) => (
                  <View style={styles.qualItem}>
                    <MaterialCommunityIcons name="check-circle" size={20} color={THEME.primary} />
                    <Text style={styles.qualText}>{item}</Text>
                  </View>
                )}
                contentContainerStyle={styles.qualList}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.bg,
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
    borderWidth: 2,
    borderColor: '#FFF',
  },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: '#FFF',
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
    borderColor: '#FFF',
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
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  editProfileText: {
    color: THEME.text,
    fontWeight: '600',
    fontSize: 14,
  },
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
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
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  logoutText: {
    color: THEME.danger,
    fontSize: 16,
    fontWeight: 'bold',
  },
  versionText: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  availabilityBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  availabilityBtnActive: {
    borderWidth: 2,
    borderColor: '#FFF',
  },
  availabilityBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  availabilityBtnTextActive: {
    color: '#FFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: THEME.text,
  },
  qualList: {
    paddingBottom: 20,
  },
  qualItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.divider,
  },
  qualText: {
    fontSize: 16,
    color: THEME.text,
    marginLeft: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    color: THEME.subText,
    fontSize: 16,
    textAlign: 'center',
  },
  addQualBtn: {
    marginTop: 20,
    backgroundColor: THEME.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addQualBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  errorBanner: {
    backgroundColor: THEME.errorBg,
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FAC8C8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorText: {
    color: THEME.error,
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
  },
});