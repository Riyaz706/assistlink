// Load .env - Expo loads EXPO_PUBLIC_* automatically, but we expose in extra for reliability
const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://assistlink-backend.onrender.com';

export default {
  expo: {
    name: 'AssistLink',
    slug: 'assistlink',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    scheme: 'assistlink',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.assistlink.app',
      infoPlist: {
        NSCameraUsageDescription: 'Allow AssistLink to access your camera for video calls.',
        NSMicrophoneUsageDescription: 'Allow AssistLink to access your microphone for video calls.',
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      package: 'com.assistlink.app',
      permissions: [
        'CAMERA',
        'RECORD_AUDIO',
        'MODIFY_AUDIO_SETTINGS',
        'android.permission.CAMERA',
        'android.permission.RECORD_AUDIO',
        'android.permission.MODIFY_AUDIO_SETTINGS',
      ],
      usesCleartextTraffic: true, // Allow http:// for local dev backend
    },
    plugins: [
      ['expo-camera', { cameraPermission: 'Allow AssistLink to access your camera for video calls.' }],
      ['expo-av', { microphonePermission: 'Allow AssistLink to access your microphone for video calls.' }],
      'expo-font'
    ],
    web: { favicon: './assets/favicon.png' },
    extra: {
      eas: { projectId: '27503afd-27f0-43cb-b2e2-c6142e7f8efb' },
      apiBaseUrl,
      EXPO_PUBLIC_API_BASE_URL: apiBaseUrl,
      EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    },
    owner: 'riyaz_26',
  },
};
