import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { api } from './api/client';
import { useErrorHandler, ErrorDetails } from './hooks/useErrorHandler';

const ErrorBanner = ({ error, onDismiss }: { error: ErrorDetails | null, onDismiss: () => void }) => {
  if (!error) return null;
  return (
    <View style={styles.errorBanner}>
      <Icon name="alert-circle" size={20} color="#FFF" />
      <Text style={styles.errorText}>{error.message}</Text>
      <TouchableOpacity onPress={onDismiss}>
        <Icon name="close" size={20} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
};

const THEME = {
  primary: "#059669",
  bg: "#F9FAFB",
  card: "#FFFFFF",
  text: "#111827",
  subText: "#6B7280",
  danger: "#EF4444",
  divider: "#E5E7EB"
};

// Default Mock Data in case navigation fails
const MOCK_APPOINTMENT = {
  status: 'Pending',
  recipient: 'New Patient',
  service: 'Initial Assessment',
  location: '123 Maple Ave',
  time: '09:00 AM',
  pay: '₹45.00',
  date: 'Oct 24, 2023',
  image: 'https://i.pravatar.cc/150?u=fake'
};

export default function CaregiverAppointmentDetailScreen({ route, navigation }: any) {
  // Safer param extraction
  const appointment = route.params?.appointment || MOCK_APPOINTMENT;

  const [status, setStatus] = useState(appointment.status);
  const [loading, setLoading] = useState(false);
  const { error, handleError, clearError } = useErrorHandler();

  // Log to verify new code is loaded
  console.log('[AppointmentDetail] Component mounted with appointment:', {
    id: appointment.id,
    service: appointment.service,
    isVideoCall: appointment.isVideoCall,
    status: appointment.status
  });

  // --- ACTIONS ---
  const handleAccept = async () => {
    console.log('[AppointmentDetail] handleAccept called!'); // Immediate log
    Alert.alert("Confirm", "Accept this appointment?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Accept",
        onPress: async () => {
          try {
            clearError();
            setLoading(true);
            console.log('[AppointmentDetail] Accepting appointment:', appointment.id);
            console.log('[AppointmentDetail] Is video call:', appointment.isVideoCall);

            // Check if this is a video call request
            if (appointment.isVideoCall) {
              // It's a video call request
              await api.acceptVideoCallRequest(appointment.id, true);
              console.log('[AppointmentDetail] Video call accepted successfully');
            } else {
              // It's a regular booking - would need a different API call
              console.log('[AppointmentDetail] Regular booking acceptance not yet implemented');
              Alert.alert('Info', 'Regular booking acceptance coming soon');
              setLoading(false);
              return;
            }

            setStatus('Confirmed');
            Alert.alert('Success', 'Appointment accepted successfully!');
          } catch (error: any) {
            handleError(error, 'accept-appointment');
          } finally {
            setLoading(false);
          }
        }
      }
    ]);
  };

  const handleDecline = async () => {
    console.log('[AppointmentDetail] handleDecline called!'); // Immediate log
    Alert.alert("Confirm", "Decline this appointment?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Decline",
        style: "destructive",
        onPress: async () => {
          try {
            clearError();
            setLoading(true);
            console.log('[AppointmentDetail] Declining appointment:', appointment.id);
            console.log('[AppointmentDetail] Is video call:', appointment.isVideoCall);

            // Check if this is a video call request
            if (appointment.isVideoCall) {
              // It's a video call request
              await api.acceptVideoCallRequest(appointment.id, false);
              console.log('[AppointmentDetail] Video call declined successfully');
            } else {
              // It's a regular booking - would need a different API call
              console.log('[AppointmentDetail] Regular booking decline not yet implemented');
              Alert.alert('Info', 'Regular booking decline coming soon');
              setLoading(false);
              return;
            }

            Alert.alert('Success', 'Appointment declined', [
              { text: 'OK', onPress: () => navigation.goBack() }
            ]);
          } catch (error: any) {
            handleError(error, 'decline-appointment');
          } finally {
            setLoading(false);
          }
        }
      }
    ]);
  };

  const handleStartCare = async () => {
    try {
      clearError();
      setLoading(true);
      console.log('[AppointmentDetail] Starting care session:', appointment.id);
      console.log('[AppointmentDetail] Video call URL:', appointment.videoCallUrl);

      if (appointment.isVideoCall) {
        // 1. Open video call URL FIRST to ensure user gets to the call
        if (appointment.videoCallUrl) {
          let url = appointment.videoCallUrl;

          // Fix for legacy/placeholder URLs in database
          if (url.includes('video-call.assistlink.app')) {
            const parts = url.split('/');
            const id = parts[parts.length - 1]; // uuid
            url = `https://meet.jit.si/assistlink-${id}`;
          }

          if (Platform.OS === 'web') {
            window.open(url, '_blank');
          } else {
            const canOpen = await Linking.canOpenURL(url);
            if (canOpen) {
              await Linking.openURL(url);
            } else {
              Alert.alert('Error', 'Cannot open video call URL');
              return;
            }
          }
        } else {
          Alert.alert('Error', 'No video call URL found');
          return;
        }

        // 2. Update status to 'accepted' (since 'in_progress' might not be in DB schema)
        // We do this in background so it doesn't block the UI
        try {
          await api.updateVideoCallStatus(appointment.id, 'accepted');
          console.log('[AppointmentDetail] Video call status updated to accepted');
        } catch (err) {
          console.warn('[AppointmentDetail] Failed to update status, but proceeding:', err);
        }

        // 3. Update local UI state
        setStatus('In-Progress');
        // No alert needed since we opened the window
      } else {
        // Regular booking - just update status
        setStatus('In-Progress');
      }
    } catch (error: any) {
      handleError(error, 'start-care');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    Alert.alert("Complete Job", "Have you finished all required tasks?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Complete",
        onPress: async () => {
          try {
            clearError();
            setLoading(true);
            console.log('[AppointmentDetail] Completing appointment');
            console.log('[AppointmentDetail] Is video call:', appointment.isVideoCall);
            console.log('[AppointmentDetail] Booking ID:', appointment.bookingId);

            if (appointment.isVideoCall) {
              // Update video call status to completed
              await api.updateVideoCallStatus(appointment.id, 'completed');
              console.log('[AppointmentDetail] Video call marked as completed');

              // If there's a booking ID, complete the booking too
              if (appointment.bookingId) {
                await api.completeBooking(appointment.bookingId);
                console.log('[AppointmentDetail] Booking marked as completed');
              }
            } else if (appointment.bookingId) {
              // Regular booking
              await api.completeBooking(appointment.bookingId);
              console.log('[AppointmentDetail] Booking marked as completed');
            }

            Alert.alert('Success', 'Job completed successfully!', [
              { text: 'OK', onPress: () => navigation.goBack() }
            ]);
          } catch (error: any) {
            handleError(error, 'complete-job');
          } finally {
            setLoading(false);
          }
        }
      }
    ]);
  };

  const handleChat = async () => {
    try {
      clearError();
      setLoading(true);
      console.log('[AppointmentDetail] Opening chat for:', appointment.recipient);

      // 1. Fetch sessions
      const sessions = await api.getChatSessions() as any[];

      // 2. Find match
      const matched = sessions.find((s: any) => {
        const other = s.care_recipient || s.caregiver;
        const name = other?.full_name || other?.name || '';
        return name && appointment.recipient &&
          name.toLowerCase() === appointment.recipient.toLowerCase();
      });

      if (matched) {
        const other = matched.care_recipient || matched.caregiver;
        navigation.navigate('ChatDetailsScreen', {
          chatSessionId: matched.id,
          otherPartyName: other?.full_name || other?.name || appointment.recipient,
          otherPartyAvatar: other?.profile_photo_url
        });
      } else {
        Alert.alert(
          "Chat",
          "No chat history found for this client.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Go to Messages",
              onPress: () => navigation.navigate('ChatList')
            }
          ]
        );
      }
    } catch (e) {
      handleError(e, 'open-chat');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={THEME.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Details</Text>
        <TouchableOpacity>
          <Icon name="dots-horizontal" size={24} color={THEME.text} />
        </TouchableOpacity>
      </View>

      <ErrorBanner error={error} onDismiss={clearError} />

      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* MAP PLACEHOLDER */}
        <View style={styles.mapContainer}>
          <View style={styles.mapPlaceholder}>
            <Ionicons name="map" size={32} color={THEME.primary} />
            <Text style={styles.mapText}>Navigation Preview</Text>
            <Text style={styles.distanceText}>12 mins • 5.2 miles</Text>
          </View>
        </View>

        {/* STATUS BAR */}
        <View style={styles.statusStrip}>
          <Text style={styles.statusLabel}>Status:</Text>
          <View style={[
            styles.statusBadge,
            status === 'Pending' ? styles.bgOrange : styles.bgGreen
          ]}>
            <Text style={[
              styles.statusText,
              status === 'Pending' ? styles.textOrange : styles.textGreen
            ]}>
              {status ? status.toUpperCase() : 'UNKNOWN'}
            </Text>
          </View>
        </View>

        {/* PATIENT CARD */}
        <View style={styles.card}>
          <View style={styles.profileHeader}>
            <Image
              source={{ uri: appointment.image || 'https://i.pravatar.cc/150?u=fake' }}
              style={styles.avatar}
            />
            <View style={styles.profileInfo}>
              <Text style={styles.name}>{appointment.recipient}</Text>
              <Text style={styles.subDetail}>Age 78 • Mobility Issues</Text>
            </View>
            {status !== 'Pending' && (
              <TouchableOpacity
                style={styles.chatBtn}
                onPress={() => {
                  // Navigate to chat with this recipient
                  // We might not have a session ID yet, so we pass the recipient details
                  // The ChatDetailsScreen (or backend) should handle find-or-create logic
                  // For now, we'll assume we pass the recipient info and let ChatDetailsScreen load
                  // If we need a session ID, we might need to fetch it first or have ChatDetailsScreen do it

                  // Simplified: Navigate to ChatDetailsScreen with user info
                  // Verify if ChatDetailsScreen can handle 'new' or 'unknown' session?
                  // Looking at ChatDetailsScreen, it expects `chatSessionId`. 
                  // If we don't have one, we might need to create it first.
                  // For this MVC, let's assume we navigate to the list or a specific "create chat" flow?
                  // Actually, better UX: Call an API to get/create session, THEN navigate.

                  // But to keep UI responsive, let's navigate to ChatList or implement a direct "open chat" function
                  // Let's implement a handleChat function.
                  handleChat();
                }}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={22} color={THEME.primary} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Date</Text>
              <Text style={styles.gridValue}>{appointment.date}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Time</Text>
              <Text style={styles.gridValue}>{appointment.time ? appointment.time.split('-')[0] : 'TBD'}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Service</Text>
              <Text style={styles.gridValue}>{appointment.service}</Text>
            </View>
          </View>
        </View>

        {/* TASKS / NOTES */}
        <Text style={styles.sectionHeader}>CARE PLAN & NOTES</Text>
        <View style={styles.card}>
          <View style={styles.taskRow}>
            <Icon name="checkbox-marked-circle-outline" size={20} color={THEME.primary} />
            <Text style={styles.taskText}>Assist with morning medication</Text>
          </View>
          <View style={styles.taskRow}>
            <Icon name="checkbox-blank-circle-outline" size={20} color={THEME.subText} />
            <Text style={styles.taskText}>Light stretching exercises (15 mins)</Text>
          </View>
          <View style={styles.taskRow}>
            <Icon name="checkbox-blank-circle-outline" size={20} color={THEME.subText} />
            <Text style={styles.taskText}>Meal preparation (Lunch)</Text>
          </View>
        </View>

        {/* ACTION BUTTONS LOGIC */}
        <View style={styles.footerAction}>
          {loading ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={THEME.primary} />
              <Text style={{ marginTop: 10, color: THEME.subText }}>Processing...</Text>
            </View>
          ) : status === 'Pending' ? (
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.btnDecline} onPress={handleDecline}>
                <Text style={styles.btnDeclineText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnAccept} onPress={handleAccept}>
                <Text style={styles.btnAcceptText}>Accept Request</Text>
              </TouchableOpacity>
            </View>
          ) : status === 'Confirmed' ? (
            <TouchableOpacity style={styles.btnPrimary} onPress={handleStartCare}>
              <Icon name="play-circle" size={20} color="#FFF" style={{ marginRight: 8 }} />
              <Text style={styles.btnPrimaryText}>Start Care Session</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.btnSuccess} onPress={handleComplete}>
              <Icon name="check-all" size={20} color="#FFF" style={{ marginRight: 8 }} />
              <Text style={styles.btnPrimaryText}>Mark as Complete</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 15,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: THEME.text },
  backBtn: { padding: 4 },
  scrollContent: { paddingHorizontal: 20 },

  mapContainer: { height: 180, borderRadius: 16, overflow: 'hidden', marginBottom: 20, marginTop: 10 },
  mapPlaceholder: {
    flex: 1, backgroundColor: '#E0F2F1', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#B2DFDB',
  },
  mapText: { marginTop: 8, color: THEME.primary, fontWeight: '700' },
  distanceText: { marginTop: 4, color: THEME.subText, fontSize: 12 },

  statusStrip: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  statusLabel: { marginRight: 10, color: THEME.subText },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 12, fontWeight: '700' },

  // Status Colors
  bgOrange: { backgroundColor: '#FEF3C7' },
  bgGreen: { backgroundColor: '#D1FAE5' },
  textOrange: { color: '#D97706' },
  textGreen: { color: '#059669' },

  card: {
    backgroundColor: THEME.card, borderRadius: 16, padding: 16, marginBottom: 24,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, elevation: 2,
  },
  profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  profileInfo: { flex: 1, marginLeft: 16 },
  name: { fontSize: 18, fontWeight: 'bold', color: THEME.text },
  subDetail: { fontSize: 13, color: THEME.subText, marginTop: 2 },
  chatBtn: { padding: 8, backgroundColor: '#F3F4F6', borderRadius: 20 },

  divider: { height: 1, backgroundColor: THEME.divider, marginBottom: 16 },

  grid: { flexDirection: 'row', justifyContent: 'space-between' },
  gridItem: { flex: 1 },
  gridLabel: { fontSize: 12, color: THEME.subText, marginBottom: 4 },
  gridValue: { fontSize: 14, fontWeight: '600', color: THEME.text },

  sectionHeader: { fontSize: 12, color: THEME.subText, fontWeight: 'bold', marginBottom: 10, marginLeft: 4, letterSpacing: 1 },
  taskRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  taskText: { marginLeft: 12, color: THEME.text, fontSize: 15 },

  footerAction: { marginTop: 10 },
  buttonRow: { flexDirection: 'row', gap: 12 },
  btnDecline: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: THEME.danger, alignItems: 'center' },
  btnDeclineText: { color: THEME.danger, fontWeight: '700' },
  btnAccept: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: THEME.primary, alignItems: 'center' },
  btnAcceptText: { color: '#FFF', fontWeight: '700' },

  btnPrimary: { flexDirection: 'row', padding: 16, borderRadius: 12, backgroundColor: THEME.primary, alignItems: 'center', justifyContent: 'center' },
  btnSuccess: { flexDirection: 'row', padding: 16, borderRadius: 12, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    padding: 10,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
  },
  errorText: {
    color: '#FFF',
    marginLeft: 8,
    flex: 1,
    fontSize: 14,
  },
});