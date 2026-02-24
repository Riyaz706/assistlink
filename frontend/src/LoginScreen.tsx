import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, StatusBar, KeyboardAvoidingView, Platform, ScrollView, Dimensions, Image, Modal, Switch } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from './context/AuthContext';
import { useGoogleAuth } from './hooks/useGoogleAuth';
import { useErrorHandler, isNetworkError, isAuthError } from './hooks/useErrorHandler';

WebBrowser.maybeCompleteAuthSession();

// If you are using Expo:
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

// If you are NOT using Expo (Bare React Native), uncomment this:
// import Icon from 'react-native-vector-icons/MaterialCommunityIcons'; 
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors as themeColors, typography as themeTypography, accessibility as themeA11y } from './theme';
import { useTheme } from './context/ThemeContext';
import { useAccessibility } from './context/AccessibilityContext';

const COLORS = {
  background: themeColors.background,
  primaryGreen: themeColors.secondary,
  darkText: themeColors.textPrimary,
  grayText: themeColors.textSecondary,
  inputBorder: themeColors.border,
  inputBackground: themeColors.card,
  placeholder: themeColors.textMuted,
  errorRed: themeColors.error,
};

const { width } = Dimensions.get('window');

const REMEMBER_ME_KEY = 'assistlink_login_remember_email';
const REMEMBER_ME_CHECKED_KEY = 'assistlink_login_remember_me';

const LoginScreen = ({ navigation }: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [useBiometrics, setUseBiometrics] = useState(false);
  const [hasStoredBiometric, setHasStoredBiometric] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('');
  const [rolePreference, setRolePreference] = useState<'user' | 'caregiver'>('user');
  const [accessibilityModalVisible, setAccessibilityModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, loginWithBiometrics, googleLogin } = useAuth();
  const { largeText, highContrast, setLargeText, setHighContrast } = useAccessibility();

  useEffect(() => {
    AsyncStorage.getItem(REMEMBER_ME_CHECKED_KEY).then((v) => {
      if (v === 'true') setRememberMe(true);
    });
    AsyncStorage.getItem(REMEMBER_ME_KEY).then((v) => {
      if (v) setEmail(v);
    });
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    (async () => {
      try {
        const { hasHardwareAsync, supportedAuthenticationTypesAsync } = await import('expo-local-authentication');
        const hasHardware = await hasHardwareAsync();
        if (!hasHardware) return;
        const types = await supportedAuthenticationTypesAsync();
        const SecureStore = (await import('expo-secure-store')).default;
        const stored = await SecureStore.getItemAsync('assistlink_biometric_refresh');
        if (stored) {
          setHasStoredBiometric(true);
          setBiometricType(Array.isArray(types) && types.includes(2) ? 'Face ID' : Array.isArray(types) && types.includes(1) ? 'Fingerprint' : 'Biometrics');
        }
      } catch {
        // Biometrics not available
      }
    })();
  }, []);

  const onRememberMeChange = (value: boolean) => {
    setRememberMe(value);
    if (value) AsyncStorage.setItem(REMEMBER_ME_CHECKED_KEY, 'true');
    else {
      AsyncStorage.removeItem(REMEMBER_ME_CHECKED_KEY);
      AsyncStorage.removeItem(REMEMBER_ME_KEY);
    }
  };
  const { signInWithGoogle, loading: googleLoading, isReady: googleReady } = useGoogleAuth();
  const { error, handleError, clearError } = useErrorHandler();
  const { colors: themeColorsResolved, typography: themeTypography } = useTheme();
  const activeColors = themeColorsResolved;
  const activeBg = activeColors.background;
  const activeTitleSize = typeof themeTypography.headingLarge === 'number' ? themeTypography.headingLarge : 24;
  const activeBodySize = typeof themeTypography.body === 'number' ? themeTypography.body : 16;

  const handleGoogleSignIn = async () => {
    setLoading(true);
    clearError();
    try {
      const result = await signInWithGoogle();
      if (result.idToken) {
        await googleLogin(result.idToken);
      } else {
        throw new Error('No ID Token received');
      }
    } catch (e: any) {
      handleError(e, 'google-login');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    // Clear previous errors
    clearError();

    // Client-side validation
    if (!email || !password) {
      handleError(new Error('Please enter email and password'), 'login-validation');
      return;
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      handleError(new Error('Please enter a valid email address'), 'login-validation');
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), password, { useBiometrics });
      if (rememberMe) {
        AsyncStorage.setItem(REMEMBER_ME_KEY, email.trim());
      }
      // Navigation handled by RootNavigator based on role
    } catch (e: any) {
      const errorDetails = handleError(e, 'login');

      // Provide specific feedback based on error type
      if (isNetworkError(e)) {
        // Network error already has good message from handleError
      } else if (isAuthError(e)) {
        // Auth error already has good message from backend
      } else {
        // Fallback for other errors
        console.error('Login error:', e);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: activeBg }]}>
      <StatusBar barStyle="dark-content" backgroundColor={activeBg} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>

          {/* Header: Back + Accessibility (PRD: Accessibility quick-access button) */}
          <View style={[styles.header, styles.headerRow]}>
            <TouchableOpacity
              onPress={() => { try { navigation.goBack(); } catch (_) {} }}
              style={styles.backButton}
              accessibilityLabel="Go back"
              accessibilityRole="button"
            >
              <Icon name="arrow-left" size={26} color={COLORS.darkText} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setAccessibilityModalVisible(true)}
              style={styles.accessibilityButton}
              accessibilityLabel="Accessibility options"
              accessibilityRole="button"
            >
              <Icon name="accessibility" size={24} color={COLORS.primaryGreen} />
            </TouchableOpacity>
          </View>

          {/* Role selection toggle (PRD: User/Caregiver) */}
          <View style={styles.roleToggleContainer}>
            <TouchableOpacity
              style={[styles.roleTab, rolePreference === 'user' && styles.roleTabActive]}
              onPress={() => setRolePreference('user')}
              accessibilityLabel="Log in as User"
              accessibilityRole="tab"
              accessibilityState={{ selected: rolePreference === 'user' }}
            >
              <Text style={[styles.roleTabText, rolePreference === 'user' && styles.roleTabTextActive]}>User</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roleTab, rolePreference === 'caregiver' && styles.roleTabActive]}
              onPress={() => setRolePreference('caregiver')}
              accessibilityLabel="Log in as Caregiver"
              accessibilityRole="tab"
              accessibilityState={{ selected: rolePreference === 'caregiver' }}
            >
              <Text style={[styles.roleTabText, rolePreference === 'caregiver' && styles.roleTabTextActive]}>Caregiver</Text>
            </TouchableOpacity>
          </View>

          {/* Logo Section */}
          <View style={styles.logoContainer}>
            <View style={styles.logoBackground}>
              <Icon name="medical-bag" size={36} color={COLORS.primaryGreen} />
            </View>
          </View>

          {/* Title and Subtitle */}
          <View style={styles.titleContainer}>
            <Text style={[styles.title, { fontSize: activeTitleSize }]}>Welcome Back</Text>
            <Text style={[styles.subtitle, { fontSize: activeBodySize }]}>
              Sign in to manage your care plan and connect with caregivers.
            </Text>
          </View>

          {hasStoredBiometric && (
            <TouchableOpacity
              style={styles.biometricButton}
              onPress={async () => {
                try {
                  const { authenticateAsync } = await import('expo-local-authentication');
                  const { success } = await authenticateAsync({
                    promptMessage: `Sign in with ${biometricType}`,
                    cancelLabel: 'Cancel',
                  });
                  if (success) {
                    setLoading(true);
                    clearError();
                    await loginWithBiometrics();
                  }
                } catch (e: any) {
                  handleError(e, 'biometric-login');
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              accessibilityLabel={`Sign in with ${biometricType}`}
              accessibilityRole="button"
            >
              <Icon name={biometricType === 'Face ID' ? 'face-recognition' : 'fingerprint'} size={28} color={COLORS.primaryGreen} />
              <Text style={styles.biometricButtonText}>Sign in with {biometricType}</Text>
            </TouchableOpacity>
          )}

          {/* Input Fields */}
          <View style={styles.formContainer}>
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Email or Phone</Text>
              <View style={styles.inputContainer}>
                <Icon name="email-outline" size={20} color={COLORS.placeholder} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor={COLORS.placeholder}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                  accessibilityLabel="Email or phone"
                  accessibilityHint="Enter your email address to sign in"
                />
              </View>
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputContainer}>
                <Icon name="lock-outline" size={20} color={COLORS.placeholder} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor={COLORS.placeholder}
                  secureTextEntry={!isPasswordVisible}
                  value={password}
                  onChangeText={setPassword}
                  accessibilityLabel="Password"
                  accessibilityHint="Enter your password"
                />
                <TouchableOpacity
                  onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                  style={styles.eyeIcon}
                  accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
                  accessibilityRole="button"
                >
                  <Icon
                    name={isPasswordVisible ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color={COLORS.placeholder}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.rememberForgotRow}>
              <View style={styles.checkboxGroup}>
                <TouchableOpacity
                  style={styles.rememberMeRow}
                  onPress={() => onRememberMeChange(!rememberMe)}
                  accessibilityLabel={rememberMe ? 'Remember me checked' : 'Remember me unchecked'}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: rememberMe }}
                >
                  <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                    {rememberMe && <Icon name="check" size={14} color="#FFF" />}
                  </View>
                  <Text style={styles.rememberMeText}>Remember me</Text>
                </TouchableOpacity>
                {Platform.OS !== 'web' && (
                  <TouchableOpacity
                    style={[styles.rememberMeRow, { marginTop: 8 }]}
                    onPress={() => setUseBiometrics(!useBiometrics)}
                    accessibilityLabel={useBiometrics ? 'Use biometrics checked' : 'Use biometrics unchecked'}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: useBiometrics }}
                  >
                    <View style={[styles.checkbox, useBiometrics && styles.checkboxChecked]}>
                      {useBiometrics && <Icon name="check" size={14} color="#FFF" />}
                    </View>
                    <Text style={styles.rememberMeText}>Use biometrics for next sign-in</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                onPress={() => navigation.navigate('ForgotPassword')}
                accessibilityLabel="Forgot password"
                accessibilityRole="link"
              >
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <Icon name="alert-circle-outline" size={20} color="#DC2626" />
                <Text style={styles.errorText}>{error.message}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={styles.loginButton}
              activeOpacity={0.7}
              onPress={handleLogin}
              disabled={loading}
              delayPressIn={0}
              accessibilityLabel={loading ? 'Logging in' : 'Log in'}
              accessibilityRole="button"
              accessibilityState={{ disabled: loading }}
            >
              <Text style={[styles.loginButtonText, { fontSize: activeBodySize }]}>
                {loading ? 'Logging in...' : 'Log In'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social Login Buttons - UPDATED */}
          <View style={styles.socialRow}>
            {/* Apple button removed */}

            <TouchableOpacity
              style={[styles.socialButton, { opacity: (!googleReady || loading || googleLoading) ? 0.5 : 1 }]}
              onPress={handleGoogleSignIn}
              disabled={!googleReady || loading || googleLoading}
              accessibilityLabel="Sign in with Google"
              accessibilityRole="button"
            >
              {/* Using a generic URL for the Google Logo */}
              <Image
                source={{ uri: 'https://cdn-icons-png.flaticon.com/512/2991/2991148.png' }}
                style={styles.googleIconImage}
              />
              <Text style={styles.socialButtonText}>Google</Text>
            </TouchableOpacity>
          </View>

          {/* Footer Register Link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Register')}
              accessibilityLabel="Go to registration"
              accessibilityRole="button"
            >
              <Text style={styles.registerText}>Register</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Accessibility Quick-Access Modal (PRD) */}
      <Modal visible={accessibilityModalVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setAccessibilityModalVisible(false)}>
          <View style={styles.accessibilityModal} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Accessibility</Text>
            <View style={styles.accessibilityRow}>
              <Text style={styles.accessibilityLabel}>Large text</Text>
              <Switch value={largeText} onValueChange={setLargeText} trackColor={{ false: '#ccc', true: COLORS.primaryGreen }} />
            </View>
            <View style={styles.accessibilityRow}>
              <Text style={styles.accessibilityLabel}>High contrast</Text>
              <Switch value={highContrast} onValueChange={setHighContrast} trackColor={{ false: '#ccc', true: COLORS.primaryGreen }} />
            </View>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setAccessibilityModalVisible(false)}>
              <Text style={styles.modalCloseText}>Done</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderColor: '#FEE2E2',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#DC2626',
    marginLeft: 8,
    fontSize: themeTypography.bodySmall,
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 30,
  },
  header: {
    marginTop: Platform.OS === 'android' ? 20 : 10,
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accessibilityButton: {
    minWidth: themeA11y.minTouchTargetSize,
    minHeight: themeA11y.minTouchTargetSize,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleToggleContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.inputBorder,
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  roleTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  roleTabActive: {
    backgroundColor: COLORS.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  roleTabText: {
    fontSize: 16,
    color: COLORS.grayText,
    fontWeight: '500',
  },
  roleTabTextActive: {
    color: COLORS.primaryGreen,
    fontWeight: '600',
  },
  rememberForgotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  checkboxGroup: { flex: 1 },
  rememberMeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: COLORS.inputBorder,
    borderRadius: 6,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.primaryGreen,
    borderColor: COLORS.primaryGreen,
  },
  rememberMeText: {
    fontSize: 14,
    color: COLORS.darkText,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  accessibilityModal: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.darkText,
    marginBottom: 20,
  },
  accessibilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  accessibilityLabel: {
    fontSize: 16,
    color: COLORS.darkText,
  },
  modalCloseBtn: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primaryGreen,
  },
  backButton: {
    minWidth: themeA11y.minTouchTargetSize,
    minHeight: themeA11y.minTouchTargetSize,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoBackground: {
    width: 80,
    height: 80,
    backgroundColor: '#D0F0D0',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.darkText,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.grayText,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  formContainer: {
    marginBottom: 24,
  },
  inputWrapper: {
    marginBottom: 20,
  },
  label: {
    fontSize: themeTypography.body,
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
    paddingHorizontal: 12,
    height: 56,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    color: COLORS.darkText,
    fontSize: 16,
  },
  eyeIcon: {
    minWidth: themeA11y.minTouchTargetSize,
    minHeight: themeA11y.minTouchTargetSize,
    justifyContent: 'center',
    alignItems: 'center',
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.primaryGreen,
    backgroundColor: COLORS.primaryGreenLight,
  },
  biometricButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primaryGreen,
  },
  forgotText: {
    color: COLORS.primaryGreen,
    fontSize: themeTypography.bodySmall,
    fontWeight: '600',
  },
  loginButton: {
    backgroundColor: COLORS.primaryGreen,
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primaryGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
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
    fontSize: themeTypography.bodySmall,
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center', // Changed from space-between to center
    marginBottom: 40,
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
    width: '100%', // Changed to full width since it's the only button
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: COLORS.grayText,
    fontSize: themeTypography.bodySmall,
  },
  registerText: {
    color: COLORS.primaryGreen,
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default LoginScreen;