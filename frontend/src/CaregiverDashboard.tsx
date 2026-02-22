import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Dimensions,
  Platform,
  ActivityIndicator,
  Alert
} from 'react-native';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import { useAuth } from './context/AuthContext';
import { useNotification } from './context/NotificationContext';
import { api } from './api/client';
import { useErrorHandler } from './hooks/useErrorHandler';
import BottomNav from './BottomNav';

const { width } = Dimensions.get('window');

// --- THEME CONFIGURATION ---
const THEME = {
  primary: "#059669",       // Emerald Green
  primaryLight: "#D1FAE5",  // Light tint for badges
  white: "#FFFFFF",
  black: "#000000",
  gray: "#F5F7FA",
  textGray: "#666666"
};

// --- TYPES ---
interface Assignment {
  id: string;
  clientName: string;
  service: string;
  status?: string;
  time?: string;
  address?: string;
  image?: string;
  pay?: string; // Pre-formatted string
  bookingData?: any; // Store full booking data for detail screen
}

interface Request {
  id: string;
  clientName: string;
  service: string;
  badge?: string | null;
  price: number;
  duration: string;
  distance: string;
  hasMap: boolean;
  image?: string;
}

const CaregiverDashboard = ({ navigation }: { navigation: any }) => {
  const { user } = useAuth();
  const route = useRoute<any>();
  const displayName = user?.full_name || "Caregiver";

  // Use global notification context
  const { assignments: upcomingAssignments, activeEmergency, loading: loadingAssignments, refresh } = useNotification();

  const { handleError } = useErrorHandler();

  // Helper to determine if a tab is active
  const isActive = (screenName: string) => route?.name === screenName;

  // Stats state
  const [stats, setStats] = useState<{ total_earnings: number; avg_rating: number } | null>(null);

  const fetchStats = async () => {
    try {
      const data = await api.getDashboardStats();
      setStats(data as any);
    } catch (error) {
      console.log('Error fetching dashboard stats:', error);
      // We don't necessarily want to show a full error screen for stats failure, just log it
    }
  };

  // Refresh when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      refresh(true); // Silent refresh on focus
      fetchStats();
    }, [])
  );

  // Helper to normalize data for the Detail Screen
  const navigateToDetails = (item: any) => {
    // For video calls, bookingData IS the video call object
    // For regular bookings, bookingData is the booking object
    const isVideoCall = item.service === 'Video Call';
    const dataObject = item.bookingData || {};

    console.log('[CaregiverDashboard] Navigating to details:', {
      id: item.id,
      service: item.service,
      isVideoCall,
      dataObject
    });

    if (isVideoCall) {
      navigation.navigate('CaregiverAppointmentDetailScreen', {
        appointment: {
          id: item.id,
          recipient: item.clientName,
          service: item.service,
          status: item.status || 'Pending',
          date: item.time,
          time: item.time,
          location: item.address,
          image: item.image,
          bookingData: dataObject, // Pass the actual data
          isVideoCall: isVideoCall, // Flag to identify video calls
          videoCallUrl: isVideoCall ? dataObject.video_call_url : undefined,
          bookingId: dataObject.booking_id || undefined,
        }
      });
    } else {
      // For regular bookings, use the robust BookingDetailScreen
      navigation.navigate('BookingDetailScreen', { bookingId: item.id });
    }
  };

  return (
    <RNSafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FA" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {(user && (user as any).profile_photo_url) ? (
            <Image
              source={{
                uri: (user as any).profile_photo_url,
              }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Icon name="account" size={24} color="#6B7280" />
            </View>
          )}
          <View>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.userName}>{displayName}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.bellBtn}
          onPress={() => navigation.navigate('Notifications')}
          accessibilityLabel="View notifications"
          accessibilityRole="button"
        >
          <Icon name="bell-outline" size={24} color="#333" />
          <View style={styles.bellBadge} />
        </TouchableOpacity>
      </View>

      {/* SOS EMERGENCY ALERT */}
      {activeEmergency && (
        <TouchableOpacity
          style={styles.sosBanner}
          onPress={() => navigation.navigate('EmergencyScreen', {
            emergency_id: activeEmergency.data?.emergency_id,
            notification: activeEmergency,
          })}
        >
          <View style={styles.sosBannerContent}>
            <View style={styles.sosIconContainer}>
              <Icon name="alert-decagram" size={28} color="#FFF" />
            </View>
            <View style={styles.sosTextContainer}>
              <Text style={styles.sosBannerTitle}>EMERGENCY ALERT</Text>
              <Text style={styles.sosBannerSub}>{activeEmergency.recipientName} needs assistance!</Text>
            </View>
            <View style={styles.sosActionBtn}>
              <Text style={styles.sosActionText}>RESPOND</Text>
            </View>
          </View>
        </TouchableOpacity>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Stats */}
        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={styles.statIconRow}>
              <Icon name="cash" size={20} color={THEME.primary} />
              <Text style={styles.statLabel}>Earnings</Text>
            </View>
            <View style={styles.statValueRow}>
              <Text style={styles.statValue}>₹{stats?.total_earnings || 0}</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIconRow}>
              <Icon name="star" size={20} color={THEME.primary} />
              <Text style={styles.statLabel}>Rating</Text>
            </View>
            <View style={styles.statValueRow}>
              <Text style={styles.statValue}>{stats?.avg_rating?.toFixed(1) || "0.0"}</Text>
            </View>
          </View>
        </View>

        {/* Upcoming Assignments */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Upcoming Assignments</Text>
          <View style={styles.sectionHeaderActions}>
            <TouchableOpacity
              onPress={() => refresh(false)}
              disabled={loadingAssignments}
              accessibilityLabel="Refresh upcoming assignments"
              accessibilityRole="button"
            >
              <Icon name="refresh" size={20} color={loadingAssignments ? '#999' : THEME.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('ScheduleScreen2')}
              accessibilityLabel="See all assignments in schedule"
              accessibilityRole="button"
            >
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loadingAssignments ? (
          <View style={styles.upcomingEmpty} accessibilityLabel="Loading upcoming assignments">
            <ActivityIndicator size="small" color={THEME.primary} />
            <Text style={styles.upcomingEmptyText}>Loading…</Text>
          </View>
        ) : upcomingAssignments.length === 0 ? (
          <View style={styles.upcomingEmpty}>
            <Icon name="calendar-blank-outline" size={32} color="#9CA3AF" />
            <Text style={styles.upcomingEmptyText}>No upcoming assignments</Text>
            <Text style={styles.upcomingEmptySubtext}>New bookings and video calls will appear here</Text>
          </View>
        ) : (
          <View style={styles.assignmentsList} accessibilityLabel={`${upcomingAssignments.length} upcoming assignment(s).`}>
            {upcomingAssignments.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.assignmentCard}
                onPress={() => navigateToDetails(item)}
                activeOpacity={0.7}
                accessibilityLabel={`${item.service} with ${item.clientName}, ${item.status}. ${item.time || ''}. Tap for details.`}
                accessibilityRole="button"
              >
                <View style={styles.assignmentHeader}>
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.clientAvatar} accessibilityIgnoresInvertColors />
                  ) : (
                    <View style={styles.clientAvatarPlaceholder}>
                      <Icon name="account" size={20} color="#6B7280" />
                    </View>
                  )}
                  <View style={styles.assignmentInfo}>
                    <Text style={styles.clientName} numberOfLines={1}>{item.clientName}</Text>
                    <Text style={styles.serviceText} numberOfLines={1}>{item.service}</Text>
                  </View>
                  <View style={styles.confirmedBadge}>
                    <Text style={styles.confirmedText}>{item.status || 'Pending'}</Text>
                  </View>
                </View>
                <View style={styles.divider} />
                <View style={styles.assignmentDetailRow}>
                  <Icon name="clock-outline" size={14} color="#666" />
                  <Text style={styles.detailText} numberOfLines={1}>{item.time || 'Date not set'}</Text>
                </View>
                <View style={styles.assignmentDetailRow}>
                  <Icon name="map-marker" size={14} color="#666" />
                  <Text style={styles.detailText} numberOfLines={2}>{item.address || 'Location not specified'}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

      </ScrollView>

      <BottomNav />
    </RNSafeAreaView >
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  scrollContent: { padding: 20, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingHorizontal: 20, paddingTop: 10 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 12, borderWidth: 2, borderColor: '#FFF' },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#FFF',
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeText: { fontSize: 12, color: '#666' },
  userName: { fontSize: 18, fontWeight: '800', color: '#000' },
  bellBtn: { minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center', padding: 8 },
  bellBadge: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: 'red' },

  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 15, color: '#333' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  statCard: { flex: 0.48, backgroundColor: '#FFF', padding: 15, borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  statIconRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  statLabel: { marginLeft: 8, color: '#666', fontWeight: '600' },
  statValueRow: { flexDirection: 'row', alignItems: 'flex-end' },
  statValue: { fontSize: 24, fontWeight: '800' },
  statGrowth: { color: THEME.primary, fontWeight: '700', marginLeft: 8, fontSize: 12, marginBottom: 4 },
  statSub: { color: '#999', fontSize: 12, marginLeft: 6, marginBottom: 4 },

  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionHeaderActions: { flexDirection: 'row', alignItems: 'center' },
  seeAllText: { color: THEME.primary, fontWeight: '700', marginLeft: 12 },

  assignmentsList: { marginBottom: 25 },
  upcomingEmpty: { padding: 24, alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, marginBottom: 8 },
  upcomingEmptyText: { color: THEME.textGray, fontSize: 14, marginTop: 8 },
  upcomingEmptySubtext: { color: '#9CA3AF', fontSize: 12, marginTop: 4 },
  assignmentCard: { backgroundColor: '#FFF', width: '100%', alignSelf: 'stretch', padding: 15, borderRadius: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  assignmentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  clientAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  clientAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  assignmentInfo: { flex: 1 },
  clientName: { fontWeight: '800', fontSize: 15 },
  serviceText: { fontSize: 12, color: '#666' },
  confirmedBadge: { backgroundColor: THEME.primaryLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  confirmedText: { color: THEME.primary, fontSize: 10, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginBottom: 10 },
  assignmentDetailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  detailText: { marginLeft: 6, color: '#555', fontSize: 12 },

  requestCountBadge: { backgroundColor: THEME.primary, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  requestCountText: { color: '#FFF', fontWeight: '800', fontSize: 12 },

  requestCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 15, marginBottom: 15, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  reqHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  newBadge: { backgroundColor: '#E6F0FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 8 },
  newBadgeText: { color: '#0066FF', fontSize: 10, fontWeight: '800' },
  reqService: { fontSize: 12, color: '#666' },
  reqClientName: { fontSize: 16, fontWeight: '800', marginTop: 4 },
  reqPrice: { fontSize: 18, fontWeight: '800' },
  perHour: { fontSize: 12, color: '#666', fontWeight: '400' },
  reqDuration: { fontSize: 11, color: '#999', textAlign: 'right' },
  reqLocationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  reqDistance: { marginLeft: 5, fontSize: 12, color: '#333' },
  mapPlaceholder: { height: 100, backgroundColor: '#E0E0E0', borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  mapText: { color: '#888', fontWeight: '600' },

  actionRow: { flexDirection: 'row', justifyContent: 'space-between' },
  declineBtn: { flex: 0.48, paddingVertical: 12, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, alignItems: 'center' },
  declineText: { fontWeight: '700', color: '#333' },
  acceptBtn: { flex: 0.48, backgroundColor: THEME.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  acceptText: { fontWeight: '700', color: '#FFF' },

  bottomNavSafeArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    minHeight: 70,
    paddingBottom: Platform.OS === 'android' ? 8 : 10,
  },
  navItem: { alignItems: 'center', justifyContent: 'center', width: 60 },
  navText: { fontSize: 10, marginTop: 4, color: '#666' },
  activeNavText: { color: THEME.primary, fontWeight: 'bold' },

  // SOS Banner
  sosBanner: {
    backgroundColor: '#EF4444',
    margin: 15,
    borderRadius: 12,
    padding: 15,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  sosBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sosIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sosTextContainer: {
    flex: 1,
  },
  sosBannerTitle: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 1,
  },
  sosBannerSub: {
    color: '#FFF',
    fontSize: 13,
    opacity: 0.9,
  },
  sosActionBtn: {
    backgroundColor: '#FFF',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  sosActionText: {
    color: '#EF4444',
    fontWeight: '800',
    fontSize: 12,
  },
});

export default CaregiverDashboard;