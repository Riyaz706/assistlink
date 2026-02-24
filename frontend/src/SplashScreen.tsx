import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, StatusBar, Easing, Image } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const SplashScreen = ({ navigation }: any) => {
  // Animation Value for the loading bar
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Start the loading bar animation
    Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1500, // Speed of the green bar
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Note: Navigation is handled by RootNavigator based on auth state
    // This screen just shows a loading animation while auth is being restored
    // No auto-navigation here - let the auth context determine the next screen
  }, []);

  // Interpolate 0-1 to X-translation values (Moves bar from left to right)
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-60, 60], 
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F9F6" />

      {/* Background Decor (Optional Glow) */}
      <View style={styles.glow} />

      {/* Company Logo */}
      <View style={styles.companyLogoContainer}>
        <Image
          source={require('../assets/techm4india-logo.png')}
          style={styles.companyLogo}
          resizeMode="contain"
        />
      </View>

      {/* Main Content: Logo & Title */}
      <View style={styles.centerContent}>
        {/* Logo Box */}
        <View style={styles.logoContainer}>
          <Icon name="medical-bag" size={48} color="white" />
          <View style={styles.logoBadge}>
            <Icon name="plus" size={16} color="#059669" />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>
          Assist<Text style={styles.titleGreen}>Link</Text>
        </Text>

        {/* Tagline */}
        <Text style={styles.tagline}>HEALTHCARE • CONNECTED</Text>
      </View>

      {/* Footer: Text & Loading Bar */}
      <View style={styles.footer}>
        <Text style={styles.description}>Connecting Caregivers &</Text>
        <Text style={styles.description}>Recipients in one seamless</Text>
        <Text style={styles.description}>experience.</Text>

        {/* Loading Bar Container */}
        <View style={styles.loaderContainer}>
          {/* Animated Green Line */}
          <Animated.View
            style={[
              styles.loaderBar,
              { transform: [{ translateX }] },
            ]}
          />
        </View>

        <Text style={styles.version}>v2.0.4</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F9F6', // Light Greenish Background
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 40,
  },
  glow: {
    position: 'absolute',
    top: -100,
    width: width,
    height: width,
    backgroundColor: 'rgba(0, 200, 0, 0.05)',
    borderRadius: width / 2,
  },
  companyLogoContainer: {
    paddingTop: 20,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  companyLogo: {
    width: width * 0.6,
    maxWidth: 220,
    height: 56,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    width: 80,
    height: 80,
    backgroundColor: '#059669', // Primary Green
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  logoBadge: {
    position: 'absolute',
    top: 18,
    width: 20,
    height: 20,
    backgroundColor: 'white',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  titleGreen: {
    color: '#059669',
  },
  tagline: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 2,
    color: '#059669',
    opacity: 0.8,
  },
  footer: {
    alignItems: 'center',
    width: '100%',
    paddingBottom: 20,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
    textAlign: 'center',
    fontWeight: '500',
  },
  // --- Loading Bar Styles ---
  loaderContainer: {
    width: 60,
    height: 6,
    backgroundColor: '#E0E0E0', // Gray background
    borderRadius: 3,
    marginTop: 24,
    marginBottom: 24,
    overflow: 'hidden', // Keeps the moving bar inside
  },
  loaderBar: {
    width: 30, // Half the width of container
    height: '100%',
    backgroundColor: '#059669', // Green moving part
    borderRadius: 3,
  },
  version: {
    fontSize: 12,
    color: '#A0A0A0',
  },
});

export default SplashScreen;