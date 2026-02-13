import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { api } from './api/client';
import { useErrorHandler, isNetworkError, retryOperation } from './hooks/useErrorHandler';

const VideoCallScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { callId, otherPartyName, videoCallUrl: initialUrl } = route.params as any;

  const [videoCallUrl, setVideoCallUrl] = useState<string | null>(initialUrl || null);
  const [loading, setLoading] = useState(true);
  const { error, handleError, clearError } = useErrorHandler();

  useEffect(() => {
    const fetchCallDetails = async () => {
      // 1. Check Permissions
      if (Platform.OS !== 'web') {
        try {
          const { Camera } = require('expo-camera');
          const { Audio } = require('expo-av');

          const cameraStatus = await Camera.requestCameraPermissionsAsync();
          const audioStatus = await Audio.requestPermissionsAsync();

          if (cameraStatus.status !== 'granted' || audioStatus.status !== 'granted') {
            Alert.alert(
              "Permissions Required",
              "Camera and Microphone permissions are needed for video calls.",
              [{ text: "Go Back", onPress: () => navigation.goBack() }]
            );
            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn("Error requesting permissions", e);
          // Continue anyway, maybe it works or user handled it
        }
      }

      if (videoCallUrl) {
        setLoading(false);
        return;
      }

      // ... existing fetch logic ...
      if (!callId) {
        handleError(new Error('No call ID provided'), 'video-call-init');
        setLoading(false);
        return;
      }

      try {
        // Use retry logic for fetching call details
        const details = await retryOperation(
          () => api.getVideoCallRequest(callId),
          {
            maxRetries: 2,
            delayMs: 1000,
            onRetry: (attempt) => {
              console.log(`[VideoCallScreen] Retry attempt ${attempt} for fetching call details`);
            }
          }
        ) as any;

        if (details && details.video_call_url) {
          let url = details.video_call_url;
          // Fix for legacy/placeholder URLs in database
          if (url.includes('video-call.assistlink.app')) {
            const parts = url.split('/');
            const id = parts[parts.length - 1]; // uuid
            url = `https://meet.jit.si/assistlink-${id}`;
          }
          setVideoCallUrl(url);
          clearError();
        } else {
          handleError(new Error('Video call URL not found'), 'video-call-fetch');
        }
      } catch (err: any) {
        console.error('Failed to fetch video call details', err);
        handleError(err, 'video-call-fetch');
      } finally {
        setLoading(false);
      }
    };

    fetchCallDetails();
  }, [callId, videoCallUrl]);

  // Notify backend that user joined the call
  useEffect(() => {
    if (callId && !loading && videoCallUrl && !error) {
      const joinCall = async () => {
        try {
          console.log('[VideoCallScreen] Joining call:', callId);
          await api.joinVideoCall(callId);
          console.log('[VideoCallScreen] Joined call notification sent');
        } catch (err: any) {
          console.error('[VideoCallScreen] Failed to send join notification', err);
          // Don't show error to user - this is non-critical
        }
      };

      joinCall();
    }
  }, [callId, loading, videoCallUrl, error]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>Connecting to video call...</Text>
      </View>
    );
  }

  if (error || !videoCallUrl) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="video-off" size={48} color="#EF4444" />
        <Text style={styles.errorText}>{error?.message || 'Unable to connect to video call'}</Text>
        <Text
          style={styles.retryButton}
          onPress={() => navigation.goBack()}
        >
          Go Back
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar hidden />
      {Platform.OS === 'web' ? (
        <View style={styles.webContainer}>
          <Text style={styles.webText}>Video calls are best experienced in a new tab on Web.</Text>
          <Text
            style={styles.openButton}
            onPress={() => window.open(videoCallUrl!, '_blank')}
          >
            Open Video Call
          </Text>
          <Text
            style={styles.retryButton}
            onPress={() => navigation.goBack()}
          >
            Go Back
          </Text>
        </View>
      ) : (
        <WebView
          source={{ uri: videoCallUrl! }}
          style={styles.webview}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#059669" />
            </View>
          )}
          // Critical for Jitsi Meet to work
          originWhitelist={['*']}
          userAgent={
            Platform.OS === 'android'
              ? 'Mozilla/5.0 (Linux; Android 10; Android SDK built for x86) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36'
              : undefined
          }
          onShouldStartLoadWithRequest={(request) => {
            // Block attempts to open other apps via intent
            if (request.url.startsWith('intent://') || request.url.startsWith('android-app://')) {
              return false;
            }
            return true;
          }}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
  },
  loadingText: {
    marginTop: 16,
    color: '#FFFFFF',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    padding: 20,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 18,
    marginTop: 12,
    marginBottom: 24,
    textAlign: 'center',
  },
  retryButton: {
    color: '#059669',
    fontSize: 16,
    fontWeight: 'bold',
    padding: 10,
  },
  webContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    padding: 20,
  },
  webText: {
    color: '#FFFFFF',
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
  },
  openButton: {
    backgroundColor: '#059669',
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
    textAlign: 'center',
  },
});

export default VideoCallScreen;
