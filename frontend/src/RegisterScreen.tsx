import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, StatusBar, KeyboardAvoidingView, Platform, ScrollView, Dimensions, Image } from 'react-native';

// Using Expo Icons
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { api } from './api/client';
import { useAuth } from './context/AuthContext';
import { useGoogleAuth } from './hooks/useGoogleAuth';
import { useErrorHandler, isNetworkError, isValidationError } from './hooks/useErrorHandler';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = {
  background: '#F4F9F6',
  primaryGreen: '#059669',
  darkText: '#1A1A1A',
  grayText: '#7A7A7A',
  inputBorder: '#E8E8E8',
  inputBackground: '#FFFFFF',
  placeholder: '#A0A0A0',
  cardBackground: '#FFFFFF',
  cardSelectedBg: '#E8F5E9',
  cardBorder: '#E8E8E8',
  errorRed: '#DC2626',
};

const { width } = Dimensions.get('window');

const RegisterScreen = ({ navigation }: any) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const [selectedRole, setSelectedRole] = useState('provide');
  const [loading, setLoading] = useState(false);
  const { login, googleLogin } = useAuth();
  const { signInWithGoogle, loading: googleLoading, isReady: googleReady } = useGoogleAuth();
  const { error, handleError, clearError } = useErrorHandler();

  // --- UPDATED: Handle Google Sign Up ---
  const handleGoogleSignUp = async () => {
    clearError();
    setLoading(true);

    try {
      // Get Google auth result
      const result = await signInWithGoogle();

      if (!result.idToken) {
        throw new Error('Failed to get Google authentication');
      }

      const role = selectedRole === 'find' ? 'care_recipient' : 'caregiver';

      // Use centralized AuthContext logic
      await googleLogin(result.idToken, role);

    } catch (err: any) {
      console.error('[RegisterScreen] Google sign up error:', err);
      handleError(err, 'google-signup');
    } finally {
      setLoading(false);
    }
  };

  // --- Helper: Format Date of Birth (DD/MM/YYYY) ---
  const handleDateChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    let formatted = cleaned;
    if (cleaned.length > 2) {
      formatted = cleaned.slice(0, 2) + '/' + cleaned.slice(2);
    }
    if (cleaned.length > 4) {
      formatted = formatted.slice(0, 5) + '/' + formatted.slice(5);
    }
    if (formatted.length <= 10) {
      setDob(formatted);
    }
  };

  const parseDobToIso = (): string | undefined => {
    if (!dob) return undefined;
    const [dd, mm, yyyy] = dob.split('/');
    if (!dd || !mm || !yyyy) return undefined;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    if (isNaN(d.getTime())) return undefined;
    return d.toISOString();
  };

  const handleCreateAccount = async () => {
    clearError();

    // Client-side validation
    if (!fullName || !email || !password) {
      handleError(new Error('Please fill all required fields'), 'validation');
      return;
    }

    // Validate full name
    if (fullName.trim().length < 2) {
      handleError(new Error('Please enter your full name'), 'validation');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      handleError(new Error('Please enter a valid email address'), 'validation');
      return;
    }

    // Validate password strength
    if (password.length < 8) {
      handleError(new Error('Password must be at least 8 characters long'), 'validation');
      return;
    }

    // Validate phone if provided
    if (phone && phone.length !== 10) {
      handleError(new Error('Please enter a valid 10-digit phone number'), 'validation');
      return;
    }

    setLoading(true);
    try {
      const role =
        selectedRole === 'find' ? 'care_recipient' : 'caregiver';

      await api.register({
        email: email.trim(),
        password,
        full_name: fullName.trim(),
        phone: phone.trim() || undefined,
        date_of_birth: parseDobToIso(),
        role,
        address: null,
        profile_photo_url: null,
      });

      // Auto-login after successful registration
      await login(email.trim(), password);
    } catch (e: any) {
      const errorDetails = handleError(e, 'register');

      // Log for debugging
      if (!isNetworkError(e) && !isValidationError(e)) {
        console.error('[RegisterScreen] Registration error:', e);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Icon name="arrow-left" size={26} color={COLORS.darkText} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Sign Up</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Main Title */}
          <View style={styles.titleContainer}>
            <Text style={styles.mainTitle}>Create your account</Text>
            <Text style={styles.subtitle}>
              Connect with the care you need, or provide care to others.
            </Text>
          </View>

          {/* Role Selection Cards */}
          <Text style={styles.sectionLabel}>I want to...</Text>
          <View style={styles.roleContainer}>
            {/* Find Care Card */}
            <TouchableOpacity
              style={[styles.roleCard, selectedRole === 'find' && styles.roleCardSelected]}
              onPress={() => setSelectedRole('find')}
              activeOpacity={0.9}
            >
              {selectedRole === 'find' && (
                <View style={styles.checkIcon}>
                  <Icon name="check-circle" size={20} color={COLORS.primaryGreen} />
                </View>
              )}
              <View style={[styles.iconCircle, selectedRole === 'find' ? { backgroundColor: '#FFFFFF' } : { backgroundColor: '#F5F5F5' }]}>
                <Icon name="hand-heart" size={32} color={selectedRole === 'find' ? COLORS.primaryGreen : COLORS.grayText} />
              </View>
              <Text style={[styles.roleText, selectedRole === 'find' && styles.roleTextSelected]}>Find Care</Text>
            </TouchableOpacity>

            {/* Provide Care Card */}
            <TouchableOpacity
              style={[styles.roleCard, selectedRole === 'provide' && styles.roleCardSelected]}
              onPress={() => setSelectedRole('provide')}
              activeOpacity={0.9}
            >
              {selectedRole === 'provide' && (
                <View style={styles.checkIcon}>
                  <Icon name="check-circle" size={20} color={COLORS.primaryGreen} />
                </View>
              )}
              <View style={[styles.iconCircle, selectedRole === 'provide' ? { backgroundColor: '#FFFFFF' } : { backgroundColor: '#F5F5F5' }]}>
                <Icon name="medical-bag" size={32} color={selectedRole === 'provide' ? COLORS.primaryGreen : COLORS.grayText} />
              </View>
              <Text style={[styles.roleText, selectedRole === 'provide' && styles.roleTextSelected]}>Care Giver</Text>
            </TouchableOpacity>
          </View>

          {/* --- GOOGLE BUTTON SECTION --- */}
          <View style={styles.socialRow}>
            <TouchableOpacity
              style={[styles.socialButton, (!googleReady || loading || googleLoading) && { opacity: 0.6 }]}
              onPress={handleGoogleSignUp}
              disabled={!googleReady || loading || googleLoading}
            >
              <Image
                source={{ uri: 'https://cdn-icons-png.flaticon.com/512/2991/2991148.png' }}
                style={styles.googleIconImage}
              />
              <Text style={styles.socialButtonText}>
                {googleLoading || loading ? 'Signing up...' : 'Sign up with Google'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* --- DIVIDER SECTION --- */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Or sign up with email</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Form Fields */}
          <View style={styles.formContainer}>
            {/* Full Name */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Full Name</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Jane Doe"
                  placeholderTextColor={COLORS.placeholder}
                  value={fullName}
                  onChangeText={setFullName}
                />
                <Icon name="account" size={20} color={COLORS.placeholder} />
              </View>
            </View>

            {/* Email Address */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Email Address</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="jane@example.com"
                  placeholderTextColor={COLORS.placeholder}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
                <Icon name="email-outline" size={20} color={COLORS.placeholder} />
              </View>
            </View>

            {/* --- PHONE NUMBER FIELD (Updated with +91) --- */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Phone Number</Text>
              <View style={styles.inputContainer}>
                {/* Fixed Prefix */}
                <Text style={styles.prefixText}>+91</Text>

                {/* Vertical Divider */}
                <View style={styles.verticalDivider} />

                <TextInput
                  style={styles.input}
                  placeholder="98765 43210"
                  placeholderTextColor={COLORS.placeholder}
                  keyboardType="number-pad"
                  maxLength={10}
                  value={phone}
                  onChangeText={setPhone}
                />
                <Icon name="phone-outline" size={20} color={COLORS.placeholder} />
              </View>
            </View>

            {/* --- Date of Birth --- */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Date of Birth</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor={COLORS.placeholder}
                  keyboardType="numeric"
                  value={dob}
                  onChangeText={handleDateChange}
                  maxLength={10}
                />
                <Icon name="calendar-month-outline" size={20} color={COLORS.placeholder} />
              </View>
            </View>

            {/* Password */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Create a strong password"
                  placeholderTextColor={COLORS.placeholder}
                  secureTextEntry={!isPasswordVisible}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setIsPasswordVisible(!isPasswordVisible)}>
                  <Icon name={isPasswordVisible ? "eye-outline" : "eye-off-outline"} size={20} color={COLORS.placeholder} />
                </TouchableOpacity>
              </View>
              <Text style={styles.helperText}>Must be at least 8 characters</Text>
            </View>

            {/* Create Account Button */}
            {error ? (
              <View style={styles.errorContainer}>
                <Icon name="alert-circle-outline" size={20} color={COLORS.errorRed} />
                <Text style={styles.errorText}>{error.message}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={styles.createButton}
              activeOpacity={0.8}
              onPress={handleCreateAccount}
              disabled={loading}
            >
              <Text style={styles.createButtonText}>
                {loading ? 'Creating...' : 'Create Account'}
              </Text>
              <Icon name="arrow-right" size={20} color="white" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}>Log in</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Platform.OS === 'android' ? 20 : 10,
    marginBottom: 24,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.darkText,
  },
  titleContainer: {
    marginBottom: 24,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.darkText,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.grayText,
    lineHeight: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.darkText,
    marginBottom: 12,
  },
  roleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  roleCard: {
    width: (width - 60) / 2,
    height: 140,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    position: 'relative',
  },
  roleCardSelected: {
    backgroundColor: COLORS.cardSelectedBg,
    borderColor: COLORS.primaryGreen,
  },
  checkIcon: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  roleText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.darkText,
  },
  roleTextSelected: {
    color: COLORS.darkText,
    fontWeight: '700',
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: 12,
    height: 56,
    width: '100%',
  },
  googleIconImage: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.darkText,
    marginLeft: 12,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerText: {
    marginHorizontal: 16,
    color: COLORS.grayText,
    fontSize: 14,
  },
  formContainer: {
    marginBottom: 24,
  },
  inputWrapper: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.darkText,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  /* NEW STYLES FOR PREFIX */
  prefixText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.darkText,
    marginRight: 8,
  },
  verticalDivider: {
    width: 1,
    height: '60%',
    backgroundColor: '#E0E0E0',
    marginRight: 10,
  },
  /* --------------------- */
  input: {
    flex: 1,
    height: '100%',
    color: COLORS.darkText,
    fontSize: 16,
    marginRight: 10,
  },
  helperText: {
    marginTop: 6,
    color: COLORS.grayText,
    fontSize: 12,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    marginBottom: 8,
    gap: 8,
  },
  errorText: {
    flex: 1,
    color: COLORS.errorRed,
    fontSize: 13,
  },
  createButton: {
    backgroundColor: COLORS.primaryGreen,
    borderRadius: 12,
    height: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    shadowColor: COLORS.primaryGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  createButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  footerText: {
    color: COLORS.grayText,
    fontSize: 14,
  },
  loginLink: {
    color: COLORS.darkText,
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default RegisterScreen;