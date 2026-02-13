import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, StatusBar, KeyboardAvoidingView, Platform, ScrollView, Dimensions, Image } from 'react-native';
import { useAuth } from './context/AuthContext';
import { useErrorHandler, isNetworkError, isAuthError } from './hooks/useErrorHandler';

// If you are using Expo:
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

// If you are NOT using Expo (Bare React Native), uncomment this:
// import Icon from 'react-native-vector-icons/MaterialCommunityIcons'; 
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = {
  background: '#F4F9F6',
  primaryGreen: '#059669',
  darkText: '#1A1A1A',
  grayText: '#7A7A7A',
  inputBorder: '#E8E8E8',
  inputBackground: '#FFFFFF',
  placeholder: '#A0A0A0',
  errorRed: '#DC2626',
};

const { width } = Dimensions.get('window');

const LoginScreen = ({ navigation }: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { error, handleError, clearError } = useErrorHandler();

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
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>

          {/* Header Back Button */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => console.log('Go Back')}>
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
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>
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
                />
                <TouchableOpacity
                  onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                  style={styles.eyeIcon}>
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
              activeOpacity={0.8}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.loginButtonText}>
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

            <TouchableOpacity style={styles.socialButton}>
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
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
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
    fontSize: 14,
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
    padding: 8,
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotText: {
    color: COLORS.primaryGreen,
    fontSize: 14,
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
    fontSize: 14,
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
    fontSize: 14,
  },
  registerText: {
    color: COLORS.primaryGreen,
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default LoginScreen;