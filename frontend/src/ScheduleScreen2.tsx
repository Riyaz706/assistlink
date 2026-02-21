import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { api } from './api/client';
import { useAuth } from './context/AuthContext';

const THEME = {
  primary: '#059669',
  bg: '#F9FAFB',
  card: '#FFFFFF',
  text: '#111827',
  subText: '#6B7280',
};

const SERVICE_LABELS: Record<string, string> = {
  exam_assistance: 'Exam Assistance',
  daily_care: 'Daily Care',
  one_time: 'One Time',
  recurring: 'Recurring',
  video_call_session: 'Video Call',
};

export default function ScheduleScreen2({ navigation }: any) {
  const { user } = useAuth();
  const [videoCalls, setVideoCalls] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [videoCallsData, bookingsData] = await Promise.all([
        api.getDashboardVideoCalls({ limit: 100 }),
        api.getDashboardBookings({
          status: 'requested,pending,accepted,in_progress', // include requested so caregiver sees new requests
          upcoming_only: true,
          limit: 50,
        }),
      ]);
      setVideoCalls(Array.isArray(videoCallsData) ? videoCallsData : []);
      setBookings(Array.isArray(bookingsData) ? bookingsData : []);
    } catch (e: any) {
      console.error("Failed to fetch schedule data:", e);
      Alert.alert("Error", "Failed to load schedule. Please pull to refresh.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const formatDate = (dateString: string) => {
    return dateString.split('T')[0];
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const statusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'requested':
        return '#B45309';
      case 'pending':
        return '#FACC15';
      case 'accepted':
      case 'confirmed':
        return '#22C55E';
      case 'declined':
        return '#DC2626';
      case 'completed':
        return '#9CA3AF';
      default:
        return '#CBD5E1';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return 'Pending';
      case 'accepted':
        return 'Accepted';
      case 'confirmed':
        return 'Confirmed';
      case 'declined':
        return 'Declined';
      case 'completed':
        return 'Completed';
      default:
        return status || 'Pending';
    }
  };

  // Unified schedule items: bookings + video calls with their schedule date
  type ScheduleEntry = { type: 'booking' | 'video_call'; item: any; scheduleDate: string | null };
  const scheduleEntries = useMemo((): ScheduleEntry[] => {
    const entries: ScheduleEntry[] = [];
    (bookings || []).forEach((b) => {
      const d = b.scheduled_date ? formatDate(b.scheduled_date) : null;
      entries.push({ type: 'booking', item: b, scheduleDate: d });
    });
    (videoCalls || []).forEach((vc) => {
      const d = vc.scheduled_time ? formatDate(vc.scheduled_time) : null;
      entries.push({ type: 'video_call', item: vc, scheduleDate: d });
    });
    return entries;
  }, [bookings, videoCalls]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Filter by selected date; always include requests (requested status or no date) so they show in schedule
  const filteredScheduleItems = useMemo(() => {
    const isRequest = (entry: ScheduleEntry) => (entry.item.status || '').toLowerCase() === 'requested' || !entry.scheduleDate;
    const forDate = scheduleEntries.filter((entry) => {
      if (entry.scheduleDate === selectedDate) return true;
      if (!entry.scheduleDate && selectedDate === todayStr) return true;
      if (isRequest(entry)) return true; // always show requests regardless of selected date
      return false;
    }).sort((a, b) => {
      const aReq = (a.item.status || '').toLowerCase() === 'requested';
      const bReq = (b.item.status || '').toLowerCase() === 'requested';
      if (aReq && !bReq) return -1;
      if (!aReq && bReq) return 1;
      const timeA = a.item.scheduled_date || a.item.scheduled_time;
      const timeB = b.item.scheduled_date || b.item.scheduled_time;
      if (!timeA) return 1;
      if (!timeB) return -1;
      return new Date(timeA).getTime() - new Date(timeB).getTime();
    });
    return forDate;
  }, [scheduleEntries, selectedDate, todayStr]);

  // When selected date has no items but we have upcoming entries, show those so schedule is never empty
  const itemsToShow = useMemo(() => {
    if (filteredScheduleItems.length > 0) return filteredScheduleItems;
    if (scheduleEntries.length === 0) return [];
    const sorted = [...scheduleEntries].sort((a, b) => {
      const aReq = (a.item.status || '').toLowerCase() === 'requested';
      const bReq = (b.item.status || '').toLowerCase() === 'requested';
      if (aReq && !bReq) return -1;
      if (!aReq && bReq) return 1;
      const timeA = a.item.scheduled_date || a.item.scheduled_time;
      const timeB = b.item.scheduled_date || b.item.scheduled_time;
      if (!timeA) return 1;
      if (!timeB) return -1;
      return new Date(timeA).getTime() - new Date(timeB).getTime();
    });
    return sorted;
  }, [filteredScheduleItems, scheduleEntries]);

  const showingOtherDates = filteredScheduleItems.length === 0 && scheduleEntries.length > 0;

  // Calendar markings (bookings + video calls with a date)
  const markedDates = useMemo(() => {
    const marks: any = {};

    const addDot = (dateStr: string, id: string, status: string) => {
      if (!dateStr) return;
      if (!marks[dateStr]) marks[dateStr] = { dots: [] };
      marks[dateStr].dots.push({ key: id, color: statusColor(status) });
    };

    (bookings || []).forEach((b) => {
      if (b.scheduled_date) addDot(formatDate(b.scheduled_date), b.id, b.status || 'pending');
    });
    (videoCalls || []).forEach((vc) => {
      if (vc.scheduled_time) addDot(formatDate(vc.scheduled_time), vc.id, vc.status || 'pending');
    });

    marks[selectedDate] = {
      ...(marks[selectedDate] || {}),
      selected: true,
      selectedColor: THEME.primary,
    };

    return marks;
  }, [bookings, videoCalls, selectedDate]);

  const openBooking = (bookingId: string) => {
    navigation.navigate('BookingDetailScreen', { bookingId });
  };

  const renderScheduleItem = ({ item: entry }: { item: ScheduleEntry }) => {
    const { type, item } = entry;
    const careRecipient = item.care_recipient || {};

    if (type === 'booking') {
      const serviceLabel = SERVICE_LABELS[item.service_type] || item.service_type || 'Booking';
      const dateTime = item.scheduled_date ? formatTime(item.scheduled_date) : 'Date not set';
      const isRequest = (item.status || '').toLowerCase() === 'requested';
      return (
        <TouchableOpacity style={styles.card} onPress={() => openBooking(item.id)} activeOpacity={0.7}>
          {isRequest && (
            <View style={styles.requestBanner}>
              <Ionicons name="mail-unread" size={14} color="#B45309" />
              <Text style={styles.requestBannerText}>Request — tap to respond</Text>
            </View>
          )}
          <View style={styles.row}>
            {careRecipient.profile_photo_url ? (
              <Image source={{ uri: careRecipient.profile_photo_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={24} color="#6B7280" />
              </View>
            )}
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={styles.name}>{careRecipient.full_name || 'Care Recipient'}</Text>
              <Text style={styles.service}>{serviceLabel}</Text>
              <Text style={styles.meta}>{dateTime}</Text>
            </View>
            <View
              style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + '33' }]}
            >
              <Text style={{ color: statusColor(item.status), fontWeight: '700', fontSize: 11 }}>
                {getStatusLabel(item.status)}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    // Video call
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('CaregiverAppointmentDetailScreen', {
          appointment: {
            id: item.id,
            recipient: careRecipient.full_name || 'Care Recipient',
            service: 'Video Call',
            status: item.status || 'Pending',
            date: item.scheduled_time,
            time: item.scheduled_time,
            location: 'Video Call',
            bookingData: item,
            isVideoCall: true,
          },
        })}
        activeOpacity={0.7}
      >
        <View style={styles.row}>
          {careRecipient.profile_photo_url ? (
            <Image source={{ uri: careRecipient.profile_photo_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={24} color="#6B7280" />
            </View>
          )}
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.name}>{careRecipient.full_name || 'Care Recipient'}</Text>
            <Text style={styles.service}>Video Call • {item.duration_seconds || 15}s</Text>
            <Text style={styles.meta}>{item.scheduled_time ? formatTime(item.scheduled_time) : 'Date not set'}</Text>
          </View>
          <View
            style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + '33' }]}
          >
            <Text style={{ color: statusColor(item.status), fontWeight: '700', fontSize: 11 }}>
              {getStatusLabel(item.status)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
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

    if (itemsToShow.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <Ionicons name="calendar-outline" size={48} color={THEME.subText} />
          <Text style={styles.emptyText}>
            No bookings or video calls on this date
          </Text>
          <Text style={styles.emptySubtext}>
            Pull to refresh or tap the calendar to pick another date.
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={itemsToShow}
        renderItem={renderScheduleItem}
        keyExtractor={(entry) => `${entry.type}-${entry.item.id}`}
        contentContainerStyle={{ padding: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={showingOtherDates ? (
          <View style={styles.otherDatesHeader}>
            <Text style={styles.otherDatesText}>No sessions on selected date. Showing upcoming:</Text>
          </View>
        ) : null}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={22} color={THEME.text} />
        </TouchableOpacity>
        <Text style={styles.title}>My Schedule</Text>
        <TouchableOpacity
          style={styles.calendarBtn}
          onPress={() => setCalendarVisible(true)}
        >
          <Ionicons name="calendar" size={22} color={THEME.primary} />
        </TouchableOpacity>
      </View>

      {/* Removed tabs - only showing video calls for caregivers */}

      {renderContent()}

      <Modal visible={calendarVisible} animationType="slide">
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.calendarHeader}>
            <Text style={styles.calendarTitle}>Select Date</Text>
            <TouchableOpacity onPress={() => setCalendarVisible(false)}>
              <Ionicons name="close" size={26} />
            </TouchableOpacity>
          </View>

          <Calendar
            markingType="multi-dot"
            markedDates={markedDates}
            onDayPress={(day) => {
              setSelectedDate(day.dateString);
              setCalendarVisible(false);
            }}
            theme={{
              todayTextColor: THEME.primary,
              arrowColor: THEME.primary,
            }}
          />

          <View style={styles.legend}>
            <Legend color="#FACC15" label="Pending" />
            <Legend color="#22C55E" label="Accepted" />
            <Legend color="#9CA3AF" label="Completed" />
            <Legend color="#DC2626" label="Declined" />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const Legend = ({ color, label }: any) => (
  <View style={styles.legendItem}>
    <View style={[styles.dot, { backgroundColor: color }]} />
    <Text>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 8,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
  },
  title: { fontSize: 20, fontWeight: '800' },
  calendarBtn: {
    padding: 8,
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
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
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
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
  row: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: { fontSize: 16, fontWeight: '700' },
  service: { fontSize: 13, color: '#6B7280' },
  meta: { fontSize: 12, color: '#9CA3AF' },
  statusBadge: {
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
  },
  calendarTitle: { fontSize: 18, fontWeight: '700' },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    paddingBottom: 20,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
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
  emptySubtext: {
    fontSize: 13,
    color: THEME.subText,
    marginTop: 8,
    textAlign: 'center',
    opacity: 0.9,
  },
  otherDatesHeader: {
    marginBottom: 12,
    paddingVertical: 8,
  },
  otherDatesText: {
    fontSize: 13,
    color: THEME.subText,
  },
});
