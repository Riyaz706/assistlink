/**
 * Video call entry (native). In Expo Go the WebRTC native module is not available,
 * so we show a fallback and never load react-native-webrtc. In dev/standalone builds
 * we lazy-load VideoCallScreenWebRTC. For web, VideoCallScreen.web.tsx is used.
 */
import React, { Suspense, lazy } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';

const VideoCallScreenWebRTC = lazy(() => import('./VideoCallScreenWebRTC'));

const isExpoGo = Constants.appOwnership === 'expo';

function WebRTCUnavailableFallback() {
  const navigation = useNavigation();
  return (
    <SafeAreaView style={styles.fallback}>
      <Ionicons name="videocam-off" size={64} color="#FACC15" />
      <Text style={styles.fallbackTitle}>Video calls not available</Text>
      <Text style={styles.fallbackBody}>
        The WebRTC native module is not available in Expo Go.
      </Text>
      <Text style={styles.fallbackHint}>
        Use a development build to enable video calls:{'\n'}
        npx expo run:android  or  npx expo run:ios
      </Text>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>Go back</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function LoadingFallback() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color="#fff" />
      <Text style={styles.loadingText}>Loading video call…</Text>
    </View>
  );
}

export default function VideoCallScreen() {
  if (isExpoGo) {
    return <WebRTCUnavailableFallback />;
  }

  return (
    <Suspense fallback={<LoadingFallback />}>
      <VideoCallScreenWebRTC />
    </Suspense>
  );
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  fallbackTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    textAlign: 'center',
  },
  fallbackBody: {
    color: '#94a3b8',
    fontSize: 16,
    marginTop: 10,
    textAlign: 'center',
  },
  fallbackHint: {
    color: '#64748b',
    fontSize: 14,
    marginTop: 20,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 28,
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#0f172a',
    fontWeight: '600',
  },
  loading: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
  },
});
