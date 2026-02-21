import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, StatusBar, KeyboardAvoidingView, Platform, ScrollView, Dimensions, Image } from 'react-native';
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

const LoginScreen = ({ navigation }: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, googleLogin } = useAuth();
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
      await login(email.trim(), password);
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

          {/* Header Back Button */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              accessibilityLabel="Go back"
              accessibilityRole="button"
            >
              <Icon name="arrow-left" size={26} color={COLORS.darkText} />
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

          {/* Input Fields */}
          <View style={styles.formContainer}>
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Email or Username</Text>
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
                  accessibilityLabel="Email or username"
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

            <TouchableOpacity
              style={styles.forgotButton}
              onPress={() => navigation.navigate('ForgotPassword')}
              accessibilityLabel="Forgot password"
              accessibilityRole="link"
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

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