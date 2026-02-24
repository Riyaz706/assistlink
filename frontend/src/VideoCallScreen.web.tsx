/**
 * Web-only: 1-to-1 WebRTC video call for AssistLink PWA.
 * Uses peer-to-peer WebRTC with Supabase Realtime signaling; no third-party video SDK.
 * Handles permission denial, network disconnect, loading and reconnect states.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from './context/AuthContext';
import useWebRTC from './hooks/useWebRTC';
import { useSafeGoBack } from './hooks/useSafeGoBack';
import { colors, spacing, typography } from './theme';
import { api } from './api/client';

export default function VideoCallScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();
  const safeGoBack = useSafeGoBack();
  const params = (route.params || {}) as {
    callId?: string;
    bookingId?: string;
    roomId?: string;
    otherPartyName?: string;
  };

  const roomId = params.callId || params.bookingId || params.roomId;
  const otherPartyName = params.otherPartyName || 'Other participant';
  const completeCallId = params.bookingId || params.callId;

  const {
    status,
    error,
    errorMessage,
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    isRemoteVideoOff,
    startCall,
    endCall,
    toggleMute,
    toggleCamera,
    retry,
  } = useWebRTC({
    roomId: roomId || '',
    userId: user?.id ?? '',
    onEnd: safeGoBack,
  });

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (localStream && localVideoRef.current && !localVideoRef.current.srcObject) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current && remoteVideoRef.current.srcObject !== remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (roomId && user?.id && status === 'idle') {
      startCall();
    }
  }, [roomId, user?.id, status]);

  const handleEndCall = async () => {
    endCall();
    if (completeCallId) {
      try {
        await api.completeVideoCall(completeCallId);
      } catch (_) {}
    }
    safeGoBack();
  };

  if (!roomId) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Ionicons name="link-outline" size={48} color={colors.textMuted} />
          <Text style={styles.title}>Missing call information</Text>
          <Text style={styles.message}>Open this screen from a booking or video call request.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={safeGoBack} accessibilityRole="button" accessibilityLabel="Go back">
            <Text style={styles.primaryButtonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isLoading = status === 'getting_media' || status === 'connecting' || status === 'idle';
  const isError = status === 'error';
  const isReconnecting = status === 'reconnecting';
  const isConnected = status === 'connected';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Reconnecting banner */}
        {isReconnecting && (
          <View style={styles.banner} accessibilityLiveRegion="polite" accessibilityRole="alert">
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.bannerText}>Reconnecting…</Text>
          </View>
        )}

        {/* Video area */}
        <View style={styles.videoContainer}>
          {/* Remote video (main) */}
          <View style={styles.remoteWrapper}>
            {Platform.OS === 'web' && (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                muted={false}
                style={styles.remoteVideo as any}
                aria-label="Remote participant video"
              />
            )}
            {(!remoteStream || isRemoteVideoOff) && (
              <View style={styles.placeholder}>
                <Ionicons name="person" size={64} color={colors.textMuted} />
                <Text style={styles.placeholderText}>
                  {isConnected ? (isRemoteVideoOff ? 'Camera off' : 'Waiting for video…') : 'Connecting…'}
                </Text>
              </View>
            )}
          </View>

          {/* Local video (pip) */}
          {localStream && (
            <View style={styles.localWrapper}>
              {Platform.OS === 'web' && (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  style={[styles.localVideo, isVideoOff && styles.localVideoOff] as unknown as React.CSSProperties}
                  aria-label="Your camera"
                />
              )}
              {isVideoOff && (
                <View style={styles.localOverlay}>
                  <Ionicons name="videocam-off" size={24} color="#fff" />
                </View>
              )}
            </View>
          )}
        </View>

        {/* Loading overlay */}
        {isLoading && !isError && (
          <View style={styles.loadingOverlay} accessibilityLiveRegion="polite">
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>
              {status === 'getting_media' ? 'Getting camera ready…' : 'Connecting…'}
            </Text>
          </View>
        )}

        {/* Error state */}
        {isError && (
          <View style={styles.errorOverlay}>
            <Ionicons
              name={error === 'permission_denied' ? 'camera-outline' : 'warning-outline'}
              size={56}
              color={colors.error}
            />
            <Text style={styles.errorTitle}>
              {error === 'permission_denied' ? 'Camera or microphone access denied' : 'Something went wrong'}
            </Text>
            <Text style={styles.errorMessage}>{errorMessage}</Text>
            <View style={styles.errorActions}>
              {(error === 'permission_denied' || error === 'signaling' || error === 'config') && (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={retry}
                  accessibilityRole="button"
                  accessibilityLabel="Try again after allowing access"
                >
                  <Text style={styles.primaryButtonText}>Try again</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={safeGoBack}
                accessibilityRole="button"
                accessibilityLabel="Leave call"
              >
                <Text style={styles.secondaryButtonText}>Leave</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Bottom bar: participant name + controls */}
        <View style={styles.bottomBar}>
          <Text style={styles.participantName} numberOfLines={1}>
            {otherPartyName}
          </Text>
          <View style={styles.controls}>
            <TouchableOpacity
              style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
              onPress={toggleMute}
              accessibilityRole="button"
              accessibilityLabel={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              accessibilityState={{ selected: isMuted }}
            >
              <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={26} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlBtn, styles.endBtn]}
              onPress={handleEndCall}
              accessibilityRole="button"
              accessibilityLabel="End call"
            >
              <Ionicons name="call" size={28} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlBtn, isVideoOff && styles.controlBtnActive]}
              onPress={toggleCamera}
              accessibilityRole="button"
              accessibilityLabel={isVideoOff ? 'Turn camera on' : 'Turn camera off'}
              accessibilityState={{ selected: isVideoOff }}
            >
              <Ionicons name={isVideoOff ? 'videocam-off' : 'videocam'} size={26} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  title: {
    fontSize: typography.headingSmall,
    fontWeight: typography.weightBold,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  message: {
    fontSize: typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  primaryButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
    borderRadius: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: typography.weightSemiBold,
    fontSize: typography.body,
  },
  secondaryButton: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    minHeight: 48,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: typography.body,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.9)',
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    gap: 8,
  },
  bannerText: {
    color: '#fff',
    fontSize: typography.bodySmall,
    fontWeight: typography.weightSemiBold,
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
  },
  remoteWrapper: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1e293b',
  },
  remoteVideo: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: colors.textMuted,
    fontSize: typography.body,
    marginTop: spacing.sm,
  },
  localWrapper: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 120,
    height: 160,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: '#1e293b',
  },
  localVideo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transform: [{ scaleX: -1 }],
  },
  localVideoOff: {
    opacity: 0.3,
  },
  localOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
  },
  loadingText: {
    color: '#fff',
    marginTop: spacing.md,
    fontSize: typography.body,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
  },
  errorTitle: {
    fontSize: typography.headingSmall,
    fontWeight: typography.weightBold,
    color: '#fff',
    marginTop: spacing.md,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: typography.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  errorActions: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  bottomBar: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
  },
  participantName: {
    color: '#fff',
    fontSize: typography.bodySmall,
    marginBottom: spacing.sm,
    maxWidth: '100%',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  controlBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlBtnActive: {
    backgroundColor: colors.error,
  },
  endBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.error,
  },
});
