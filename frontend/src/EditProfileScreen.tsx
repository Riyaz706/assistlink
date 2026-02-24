import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import BottomNav from './BottomNav';
import { useAuth } from './context/AuthContext';
import { api } from './api/client';

// Conditional import for image picker
let ImagePicker: any = null;
if (Platform.OS !== 'web') {
  try {
    ImagePicker = require('expo-image-picker');
  } catch (e) {
    console.warn('expo-image-picker not available:', e);
  }
}

const THEME = {
  bg: '#F8F9FA',
  card: '#FFFFFF',
  primary: '#059669',
  text: '#1F2937',
  subText: '#6B7280',
  border: '#E5E7EB',
  error: '#EF4444',
};

import { useErrorHandler } from './hooks/useErrorHandler';

export default function EditProfileScreen({ navigation, route }: any) {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { handleError, error, clearError } = useErrorHandler();

  // User profile fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  // Caregiver-specific fields
  const [bio, setBio] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [skills, setSkills] = useState('');
  const [languagesSpoken, setLanguagesSpoken] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [caregiverProfile, setCaregiverProfile] = useState<any>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const pickImage = async () => {
    clearError();
    if (!ImagePicker) {
      handleError(new Error('Image picker is only available on mobile devices.'), 'feature-unavailable');
      return;
    }

    try {
      setUploadingImage(true);

      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        handleError(new Error('We need camera roll permissions to select an image.'), 'permission-denied');
        setUploadingImage(false);
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const imageUri = asset.uri;
        const fileName = asset.fileName || 'photo.jpg';
        const mimeType = asset.mimeType || 'image/jpeg';

        const { profile_photo_url } = await api.uploadProfilePhoto(imageUri, fileName, mimeType);
        setProfilePhotoUrl(profile_photo_url);
        if (refreshUser) refreshUser();
      }
    } catch (error: any) {
      handleError(error, 'image-picker');
    } finally {
      setUploadingImage(false);
    }
  };

  const loadProfile = async () => {
    setLoading(true);
    clearError();
    try {
      // Load user profile
      const profile: any = await api.getProfile();
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
      setEmail(profile.email || '');

      // Format date of birth
      if (profile.date_of_birth) {
        const date = new Date(profile.date_of_birth);
        setDateOfBirth(date.toISOString().split('T')[0]);
      }

      // Format address - handle both string and object formats
      if (profile.address) {
        if (typeof profile.address === 'string') {
          setAddress(profile.address);
        } else if (typeof profile.address === 'object' && profile.address !== null) {
          // If it's an object, try to extract text field or stringify
          if (profile.address.text) {
            setAddress(profile.address.text);
          } else {
            // If no text field, stringify the whole object
            setAddress(JSON.stringify(profile.address));
          }
        }
      }

      // Set profile photo URL
      setProfilePhotoUrl(profile.profile_photo_url || '');

      // Load caregiver profile if user is a caregiver
      if (user?.role === 'caregiver') {
        try {
          const cgProfile: any = await api.getCaregiverProfile();
          setCaregiverProfile(cgProfile);
          setBio(cgProfile.bio || '');
          setQualifications((cgProfile.qualifications || []).join(', ') || '');
          setSkills((cgProfile.skills || []).join(', ') || '');
          setLanguagesSpoken((cgProfile.languages_spoken || []).join(', ') || '');
          setExperienceYears(cgProfile.experience_years?.toString() || '');
          setHourlyRate(cgProfile.hourly_rate?.toString() || '');
        } catch (e) {
          console.log('No caregiver profile found yet');
        }
      }
    } catch (error: any) {
      handleError(error, 'profile-load');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    clearError();
    try {
      // Update user profile
      const updateData: any = {
        full_name: fullName.trim(),
        phone: phone.trim() || null,
      };

      if (dateOfBirth) {
        updateData.date_of_birth = new Date(dateOfBirth).toISOString();
      }

      // Handle address - always include it (even if empty, to allow clearing)
      // Backend expects address as Dict[str, Any], so we format it properly
      if (address.trim()) {
        try {
          // Try to parse as JSON first (in case it's a JSON string)
          const parsed = JSON.parse(address);
          if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            // Valid JSON object
            updateData.address = parsed;
          } else {
            // Parsed but not a valid object, wrap in a text field
            updateData.address = { text: address.trim() };
          }
        } catch {
          // If not valid JSON, treat as plain text and wrap in object
          // Backend expects Dict[str, Any], so we create an object
          updateData.address = { text: address.trim() };
        }
      } else {
        // Allow clearing address by setting to null
        updateData.address = null;
      }

      if (profilePhotoUrl.trim()) {
        updateData.profile_photo_url = profilePhotoUrl.trim();
      } else {
        updateData.profile_photo_url = null;
      }

      await api.updateProfile(updateData);

      // Update caregiver profile if applicable
      if (user?.role === 'caregiver') {
        const cgUpdateData: any = {};

        if (bio.trim()) cgUpdateData.bio = bio.trim();
        else cgUpdateData.bio = null;

        // Qualifications - split by comma, trim, filter out empty, or set to empty array if empty string
        const qualList = qualifications.split(',').map(q => q.trim()).filter(Boolean);
        cgUpdateData.qualifications = qualList;

        // Skills - same logic
        const skillList = skills.split(',').map(s => s.trim()).filter(Boolean);
        cgUpdateData.skills = skillList;

        // Languages spoken - PRD
        const langList = languagesSpoken.split(',').map(l => l.trim()).filter(Boolean);
        cgUpdateData.languages_spoken = langList;

        if (experienceYears.trim()) {
          cgUpdateData.experience_years = parseInt(experienceYears) || null;
        } else {
          cgUpdateData.experience_years = null;
        }

        if (hourlyRate.trim()) {
          cgUpdateData.hourly_rate = parseFloat(hourlyRate) || null;
        } else {
          cgUpdateData.hourly_rate = null;
        }

        if (Object.keys(cgUpdateData).length > 0) {
          try {
            await api.updateCaregiverProfile(cgUpdateData);
          } catch (e: any) {
            // If profile doesn't exist, create it
            if (e.message?.includes('not found')) {
              await api.updateCaregiverProfile(cgUpdateData); // This will create if using POST
            } else {
              throw e;
            }
          }
        }
      }

      // Refresh user data
      await refreshUser();

      Alert.alert('Success', 'Profile updated successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      handleError(error, 'profile-save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.primary} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={THEME.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color={THEME.primary} />
          ) : (
            <Text style={styles.saveButton}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {error && (
          <View style={{ marginBottom: 20, padding: 12, backgroundColor: '#FEF2F2', borderRadius: 8 }}>
            <Text style={{ color: '#DC2626' }}>{error.message}</Text>
          </View>
        )}
        {/* Personal Information */}
        <Text style={styles.sectionTitle}>Personal Information</Text>
        <View style={styles.sectionCard}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name *</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter your full name"
              placeholderTextColor={THEME.subText}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, styles.disabledInput]}
              value={email}
              editable={false}
              placeholderTextColor={THEME.subText}
            />
            <Text style={styles.helperText}>Email cannot be changed</Text>
          </View>

          {/* Profile Photo Section */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Profile Photo</Text>
            <View style={styles.photoSection}>
              {profilePhotoUrl ? (
                <Image source={{ uri: profilePhotoUrl }} style={styles.profileImagePreview} />
              ) : (
                <View style={styles.profileImagePlaceholder}>
                  <MaterialCommunityIcons name="account" size={40} color={THEME.subText} />
                </View>
              )}
              <View style={styles.photoInputContainer}>
                <TextInput
                  style={styles.input}
                  value={profilePhotoUrl}
                  onChangeText={setProfilePhotoUrl}
                  placeholder="Enter image URL"
                  placeholderTextColor={THEME.subText}
                  keyboardType="url"
                  autoCapitalize="none"
                />
                {ImagePicker && (
                  <TouchableOpacity
                    style={styles.imagePickerButton}
                    onPress={pickImage}
                    disabled={uploadingImage}
                  >
                    {uploadingImage ? (
                      <ActivityIndicator size="small" color={THEME.primary} />
                    ) : (
                      <MaterialCommunityIcons name="camera" size={20} color={THEME.primary} />
                    )}
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.helperText}>
                Enter an image URL or use camera to take a photo
              </Text>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="Enter your phone number"
              placeholderTextColor={THEME.subText}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Date of Birth</Text>
            <TextInput
              style={styles.input}
              value={dateOfBirth}
              onChangeText={setDateOfBirth}
              placeholder="YYYY-MM-DD (e.g., 1990-01-15)"
              placeholderTextColor={THEME.subText}
            />
            <Text style={styles.helperText}>Format: YYYY-MM-DD</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Address</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={address}
              onChangeText={setAddress}
              placeholder="Enter your address"
              placeholderTextColor={THEME.subText}
              multiline
              numberOfLines={3}
            />
          </View>
        </View>

        {/* Caregiver-Specific Fields */}
        {user?.role === 'caregiver' && (
          <>
            <Text style={styles.sectionTitle}>Caregiver Information</Text>
            <View style={styles.sectionCard}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Bio</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Tell us about yourself..."
                  placeholderTextColor={THEME.subText}
                  multiline
                  numberOfLines={4}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Qualifications</Text>
                <TextInput
                  style={styles.input}
                  value={qualifications}
                  onChangeText={setQualifications}
                  placeholder="e.g. Certified Nursing Assistant, First Aid"
                  placeholderTextColor={THEME.subText}
                />
                <Text style={styles.helperText}>Separate multiple qualifications with commas</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Skills</Text>
                <TextInput
                  style={styles.input}
                  value={skills}
                  onChangeText={setSkills}
                  placeholder="e.g. Elderly care, Medication management"
                  placeholderTextColor={THEME.subText}
                />
                <Text style={styles.helperText}>Separate multiple skills with commas</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Languages Spoken</Text>
                <TextInput
                  style={styles.input}
                  value={languagesSpoken}
                  onChangeText={setLanguagesSpoken}
                  placeholder="e.g. English, Hindi, Tamil"
                  placeholderTextColor={THEME.subText}
                />
                <Text style={styles.helperText}>Separate multiple languages with commas</Text>
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>Experience (Years)</Text>
                  <TextInput
                    style={styles.input}
                    value={experienceYears}
                    onChangeText={setExperienceYears}
                    placeholder="0"
                    placeholderTextColor={THEME.subText}
                    keyboardType="numeric"
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.label}>Hourly Rate (₹)</Text>
                  <TextInput
                    style={styles.input}
                    value={hourlyRate}
                    onChangeText={setHourlyRate}
                    placeholder="0.00"
                    placeholderTextColor={THEME.subText}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
      <BottomNav />
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
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: THEME.text,
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.primary,
  },
  scrollContent: {
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: THEME.subText,
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: THEME.subText,
    marginBottom: 12,
    marginTop: 8,
    letterSpacing: 0.5,
  },
  sectionCard: {
    backgroundColor: THEME.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: THEME.text,
  },
  disabledInput: {
    backgroundColor: '#F3F4F6',
    color: THEME.subText,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: 12,
    color: THEME.subText,
    marginTop: 4,
  },
  photoSection: {
    alignItems: 'center',
  },
  profileImagePreview: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: THEME.border,
  },
  profileImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: THEME.border,
  },
  photoInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  imagePickerButton: {
    marginLeft: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});

