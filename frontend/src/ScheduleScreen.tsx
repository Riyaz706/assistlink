import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useErrorHandler } from './hooks/useErrorHandler';
import { api } from './api/client';
import { useAuth } from './context/AuthContext';

const THEME = {
  primary: "#059669",
  bg: "#F6FAF5",
  card: "#FFFFFF",
  text: "#111827",
  subText: "#6B7280",
  pendingBg: "#FFF7ED",
  pendingText: "#C2410C",
  scheduledBg: "#ECFDF5",
  scheduledText: "#047857",
  acceptedBg: "#DBEAFE",
  acceptedText: "#2563EB",
  declinedBg: "#FEE2E2",
  declinedText: "#DC2626",
  error: "#EF4444",
};

export default function ScheduleScreen({ navigation, route }: any) {
  const { user } = useAuth();
  const { handleError, error, clearError } = useErrorHandler();
  const [videoCalls, setVideoCalls] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'video-calls' | 'bookings'>('video-calls');
  const [startedVideoCalls, setStartedVideoCalls] = useState<Set<string>>(new Set());

  // Hide video-calls tab if any video call has been started
  const shouldHideVideoCallsTab = startedVideoCalls.size > 0;

  const fetchData = async () => {
    try {
      if (!refreshing) setLoading(true);
      clearError();
      const [videoCallsData, bookingsData] = await Promise.all([
        api.getDashboardVideoCalls({ limit: 100 }),
        api.getDashboardBookings({
          limit: 100,
          status: 'requested,pending,accepted,in_progress,completed', // exclude cancelled
        }),
      ]);
      console.log("[ScheduleScreen] Video calls fetched:", (videoCallsData as any[])?.length || 0);
      console.log("[ScheduleScreen] Bookings fetched:", (bookingsData as any[])?.length || 0);
      setVideoCalls(Array.isArray(videoCallsData) ? videoCallsData : []);
      setBookings(Array.isArray(bookingsData) ? bookingsData : []);
    } catch (e: any) {
      console.error("Failed to fetch schedule data:", e);
      handleError(e, 'schedule-fetch');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Refresh data when screen gains focus (e.g., after caregiver accepts video call and booking is created)
  useFocusEffect(
    React.useCallback(() => {
      fetchData();

      // Set up polling to refresh bookings every 10 seconds when screen is focused
      // This ensures bookings appear immediately after caregiver accepts
      const intervalId = setInterval(() => {
        fetchData();
      }, 10000); // Refresh every 10 seconds

      return () => {
        clearInterval(intervalId);
      };
    }, [])
  );

  useEffect(() => {
    if (route.params?.paymentSuccess && route.params?.appointmentId) {
      fetchData();
    }
  }, [route.params]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'requested':
        return { bg: '#FEF3C7', text: '#B45309' };
      case 'pending':
        return { bg: THEME.pendingBg, text: THEME.pendingText };
      case 'accepted':
        return { bg: THEME.acceptedBg, text: THEME.acceptedText };
      case 'declined':
        return { bg: THEME.declinedBg, text: THEME.declinedText };
      case 'completed':
        return { bg: THEME.scheduledBg, text: THEME.scheduledText };
      default:
        return { bg: THEME.pendingBg, text: THEME.pendingText };
    }
  };

  const renderVideoCallItem = ({ item }: { item: any }) => {
    const statusColors = getStatusColor(item.status);
    const caregiver = item.caregiver || {};

    const canStartCall = item.status?.toLowerCase() === 'accepted' && !startedVideoCalls.has(item.id);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          {caregiver.profile_photo_url ? (
            <Image source={{ uri: caregiver.profile_photo_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Icon name="account" size={24} color="#6B7280" />
            </View>
          )}
          <View style={styles.info}>
            <Text style={styles.name}>
              Video call with {caregiver.full_name || 'Caregiver'}
            </Text>
            <Text style={styles.role}>
              Caregiver: {caregiver.full_name || 'Not specified'} • {item.duration_seconds || 15}s
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
            <Text style={[styles.statusText, { color: statusColors.text }]}>
              {item.status?.charAt(0).toUpperCase() + item.status?.slice(1) || 'Pending'}
            </Text>
          </View>
        </View>

        <View style={styles.dateTimeRow}>
          <View style={styles.dtItem}>
            <Icon name="calendar" size={16} color={THEME.subText} />
            <Text style={styles.dtText}>
              {item.start_time
                ? formatDate(item.start_time)
                : formatDate(item.scheduled_time)}
            </Text>
          </View>
          <View style={styles.dtItem}>
            <Icon name="clock-outline" size={16} color={THEME.subText} />
            <Text style={styles.dtText}>
              {item.start_time && item.end_time
                ? `${formatTime(item.start_time)} - ${formatTime(item.end_time)}`
                : formatTime(item.scheduled_time)}
            </Text>
          </View>
          {(item.duration_hours != null && item.duration_hours !== '') && (
            <View style={styles.dtItem}>
              <Icon name="timer" size={16} color={THEME.subText} />
              <Text style={styles.dtText}>{item.duration_hours}h</Text>
            </View>
          )}
        </View>

        {/* Service Type and Location */}
        {item.service_type && (
          <View style={styles.detailRow}>
            <Icon name="briefcase" size={16} color={THEME.subText} />
            <Text style={styles.detailText}>
              {item.service_type === 'exam_assistance' ? 'Exam Assistance' :
                item.service_type === 'daily_care' ? 'Daily Care' :
                  item.service_type === 'emergency' ? 'Emergency' :
                    item.service_type}
            </Text>
          </View>
        )}
        {item.location && (
          <View style={styles.detailRow}>
            <Icon name="map-marker" size={16} color={THEME.subText} />
            <Text style={styles.detailText}>
              {typeof item.location === 'string'
                ? item.location
                : item.location?.text || item.location?.address || 'Location not specified'}
            </Text>
          </View>
        )}

        {canStartCall && (
          <TouchableOpacity
            style={styles.callBtn}
            onPress={async () => {
              // Mark this video call as started (this will hide the video-calls tab)
              setStartedVideoCalls(prev => new Set(prev).add(item.id));
              // Switch to bookings tab immediately to hide video-calls tab
              setActiveTab('bookings');
              // Accept video call request on behalf of care recipient if not already accepted
              try {
                if (!item.care_recipient_accepted) {
                  console.log('[ScheduleScreen] Accepting video call request on behalf of care recipient...');
                  await api.acceptVideoCallRequest(item.id, true);
                  console.log('[ScheduleScreen] Video call request accepted');
                }
                // Refresh data to show the booking that should have been created
                await fetchData();
              } catch (error: any) {
                console.error('[ScheduleScreen] Error accepting video call:', error);
                handleError(error, 'accept-video-call');
                // We typically still want to navigate to the video call even if acceptance/refresh fails
                // as it might be a transient network issue or already accepted.
              }
              // Navigate to video call screen (15-second placeholder)
              navigation.navigate('VideoCallScreen', {
                callId: item.id,
                otherPartyName: caregiver.full_name || 'Caregiver',
              });
            }}
          >
            <Icon name="video" size={18} color="#fff" />
            <Text style={styles.callBtnText}>Start Video Call</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderBookingItem = ({ item }: { item: any }) => {
    const statusColors = getStatusColor(item.status);
    const caregiver = item.caregiver || {};
    const isRequested = (item.status || '').toLowerCase() === 'requested';

    const serviceTypeMap: Record<string, string> = {
      'exam_assistance': 'Exam Assistance',
      'daily_care': 'Daily Care',
      'one_time': 'One Time',
      'recurring': 'Recurring',
      'video_call_session': 'Video Call Session',
    };
    const serviceType = serviceTypeMap[item.service_type] || item.service_type;

    const isPending = item.status === 'pending';

    return (
      <View style={styles.card}>
        {isRequested && (
          <View style={styles.requestBanner}>
            <Icon name="clock-outline" size={16} color="#B45309" />
            <Text style={styles.requestBannerText}>Request sent — waiting for caregiver to respond</Text>
          </View>
        )}
        <View style={styles.cardHeader}>
          {caregiver.profile_photo_url ? (
            <Image source={{ uri: caregiver.profile_photo_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Icon name="account" size={24} color="#6B7280" />
            </View>
          )}
          <View style={styles.info}>
            <Text style={styles.name}>
              Booking with {caregiver.full_name || 'Caregiver'}
            </Text>
            <Text style={styles.role}>
              Caregiver: {caregiver.full_name || 'Not specified'} • {serviceType}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
            <Text style={[styles.statusText, { color: statusColors.text }]}>
              {item.status?.charAt(0).toUpperCase() + item.status?.slice(1) || 'Pending'}
            </Text>
          </View>
        </View>

        <View style={styles.dateTimeRow}>
          <View style={styles.dtItem}>
            <Icon name="calendar" size={16} color={THEME.subText} />
            <Text style={styles.dtText}>{formatDate(item.scheduled_date)}</Text>
          </View>
          <View style={styles.dtItem}>
            <Icon name="clock-outline" size={16} color={THEME.subText} />
            <Text style={styles.dtText}>{formatTime(item.scheduled_date)}</Text>
          </View>
          {(item.duration_hours != null && item.duration_hours !== '') && (
            <View style={styles.dtItem}>
              <Icon name="timer" size={16} color={THEME.subText} />
              <Text style={styles.dtText}>{item.duration_hours}h</Text>
            </View>
          )}
        </View>

        {isPending && item.status === 'pending' && (
          <View>
            <Text style={styles.pendingPaymentText}>
              Payment pending - Complete payment to confirm booking
            </Text>
            <TouchableOpacity style={styles.payBtn} onPress={() => navigation.navigate('PaymentScreen', { appointment: item })}>
              <Text style={styles.payBtnText}>Pay Now</Text>
              <Icon name="chevron-right" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderContent = () => {
    if (loading && !refreshing) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.loadingText}>Loading schedule...</Text>
        </View>
      );
    }

    // If video-calls tab is hidden, default to bookings
    const currentTab = shouldHideVideoCallsTab ? 'bookings' : activeTab;
    const data = currentTab === 'video-calls' ? videoCalls : bookings;
    const renderItem = currentTab === 'video-calls' ? renderVideoCallItem : renderBookingItem;

    if (data.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <Icon name={currentTab === 'video-calls' ? 'video-off' : 'calendar-blank'} size={48} color={THEME.subText} />
          <Text style={styles.emptyText}>
            No {currentTab === 'video-calls' ? 'video calls' : 'bookings'} scheduled
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>My Schedule</Text>
        <View style={{ width: 24 }} />
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Icon name="alert-circle" size={20} color="#fff" />
          <Text style={styles.errorText} numberOfLines={2}>
            {error.message || "An error occurred"}
          </Text>
          <TouchableOpacity onPress={clearError}>
            <Icon name="close" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.tabsContainer}>
        {!shouldHideVideoCallsTab && (
          <TouchableOpacity
            style={[styles.tab, activeTab === 'video-calls' && styles.activeTab]}
            onPress={() => setActiveTab('video-calls')}
          >
            <Icon name="video" size={18} color={activeTab === 'video-calls' ? '#fff' : THEME.subText} />
            <Text style={[styles.tabText, activeTab === 'video-calls' && styles.activeTabText]}>
              Video Calls ({videoCalls.length})
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.tab, activeTab === 'bookings' && styles.activeTab]}
          onPress={() => setActiveTab('bookings')}
        >
          <Icon name="calendar" size={18} color={activeTab === 'bookings' ? '#fff' : THEME.subText} />
          <Text style={[styles.tabText, activeTab === 'bookings' && styles.activeTabText]}>
            Bookings ({bookings.length})
          </Text>
        </TouchableOpacity>
      </View>

      {renderContent()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: '700', color: THEME.text },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    gap: 6,
  },
  activeTab: {
    backgroundColor: THEME.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.subText,
  },
  activeTabText: {
    color: '#fff',
  },
  card: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  requestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 10,
    gap: 6,
  },
  requestBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B45309',
  },
  cardHeader: { flexDirection: 'row', marginBottom: 12 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#eee' },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '700', color: THEME.text },
  role: { fontSize: 13, color: THEME.subText, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, height: 26 },
  statusText: { fontSize: 11, fontWeight: '700' },
  dateTimeRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
    marginTop: 4,
  },
  dtItem: { flexDirection: 'row', alignItems: 'center', marginRight: 16 },
  dtText: { marginLeft: 6, color: THEME.subText, fontSize: 13, fontWeight: '500' },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginLeft: 4 },
  detailText: { marginLeft: 8, color: THEME.subText, fontSize: 13, flex: 1 },
  pendingPaymentText: {
    fontSize: 12,
    color: THEME.pendingText,
    marginBottom: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  payBtn: {
    marginTop: 8,
    backgroundColor: THEME.primary,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  payBtnText: { color: '#fff', fontWeight: '700', fontSize: 14, marginRight: 4 },
  callBtn: {
    marginTop: 12,
    backgroundColor: THEME.primary,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  callBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: THEME.subText,
    marginTop: 12,
  },
  emptyText: {
    fontSize: 16,
    color: THEME.subText,
    marginTop: 12,
    textAlign: 'center',
  },
  errorBanner: {
    backgroundColor: THEME.error,
    padding: 12,
    margin: 16,
    marginBottom: 0,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
    fontWeight: '500',
  },
});
