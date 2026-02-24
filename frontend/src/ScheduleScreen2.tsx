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
import { useErrorHandler } from './hooks/useErrorHandler';
import BottomNav from './BottomNav';
import { getServiceTypeLabel, formatSlotDateTime } from './constants/labels';

const THEME = {
  primary: '#059669',
  bg: '#F9FAFB',
  card: '#FFFFFF',
  text: '#111827',
  subText: '#6B7280',
};

export default function ScheduleScreen2({ navigation }: any) {
  const { user } = useAuth();
  const { handleError, error, clearError } = useErrorHandler();
  const [videoCalls, setVideoCalls] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Date range: 'date' = selected date only, 'week' = week containing selected date, 'all' = all dates
  const [dateRange, setDateRange] = useState<'date' | 'week' | 'all'>('date');
  // Type filter: 'all' | 'assignments' | 'video_calls'
  const [typeFilter, setTypeFilter] = useState<'all' | 'assignments' | 'video_calls'>('all');
  // Status filter: 'all' | 'pending' | 'confirmed' | 'in_progress' | 'completed'
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'in_progress' | 'completed'>('all');

  const fetchData = async () => {
    try {
      if (!refreshing) setLoading(true);
      clearError();
      const [videoCallsData, bookingsData] = await Promise.all([
        api.getDashboardVideoCalls({ limit: 100 }),
        api.getDashboardBookings({
          status: 'requested,pending,accepted,confirmed,in_progress',
          upcoming_only: false,
          limit: 50,
        }),
      ]);
      const vcList = Array.isArray(videoCallsData) ? videoCallsData : [];
      const bkList = Array.isArray(bookingsData) ? bookingsData : [];
      setVideoCalls(vcList);
      setBookings(bkList);
    } catch (e: any) {
      console.error("Failed to fetch schedule data:", e);
      handleError(e, 'schedule-load');
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

  // Week bounds for selected date (Sun–Sat)
  const weekStartEnd = useMemo(() => {
    const d = new Date(selectedDate + 'T12:00:00Z');
    const day = d.getUTCDay();
    const start = new Date(d);
    start.setUTCDate(d.getUTCDate() - day);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    return {
      startStr: start.toISOString().split('T')[0],
      endStr: end.toISOString().split('T')[0],
    };
  }, [selectedDate]);

  const sortEntries = useCallback((entries: ScheduleEntry[]) => {
    return [...entries].sort((a, b) => {
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
  }, []);

  // 1) Apply type filter (all | assignments | video_calls)
  const typeFilteredEntries = useMemo(() => {
    if (typeFilter === 'all') return scheduleEntries;
    if (typeFilter === 'assignments') return scheduleEntries.filter((e) => e.type === 'booking');
    return scheduleEntries.filter((e) => e.type === 'video_call');
  }, [scheduleEntries, typeFilter]);

  // 2) Apply status filter
  const statusMatches = (entry: ScheduleEntry, statusKey: string) => {
    const s = (entry.item.status || '').toLowerCase();
    if (statusKey === 'pending') return s === 'requested' || s === 'pending';
    if (statusKey === 'confirmed') return s === 'accepted' || s === 'confirmed';
    if (statusKey === 'in_progress') return s === 'in_progress';
    if (statusKey === 'completed') return s === 'completed';
    return true;
  };
  const statusFilteredEntries = useMemo(() => {
    if (statusFilter === 'all') return typeFilteredEntries;
    return typeFilteredEntries.filter((e) => statusMatches(e, statusFilter));
  }, [typeFilteredEntries, statusFilter]);

  // 3) Filter by date range; include undated/requested when viewing selected date or week
  const filteredScheduleItems = useMemo(() => {
    const isRequest = (entry: ScheduleEntry) => (entry.item.status || '').toLowerCase() === 'requested' || !entry.scheduleDate;
    let forDate: ScheduleEntry[];
    if (dateRange === 'all') {
      forDate = statusFilteredEntries;
    } else if (dateRange === 'week') {
      forDate = statusFilteredEntries.filter((entry) => {
        if (!entry.scheduleDate && isRequest(entry)) return true;
        if (!entry.scheduleDate) return false;
        return entry.scheduleDate >= weekStartEnd.startStr && entry.scheduleDate <= weekStartEnd.endStr;
      });
    } else {
      forDate = statusFilteredEntries.filter((entry) => {
        if (entry.scheduleDate === selectedDate) return true;
        if (!entry.scheduleDate && selectedDate === todayStr) return true;
        if (isRequest(entry)) return true;
        return false;
      });
    }
    return sortEntries(forDate);
  }, [statusFilteredEntries, dateRange, selectedDate, todayStr, weekStartEnd, sortEntries]);

  // When selected date/week has no items but we have entries, show sorted list so schedule is never empty
  const itemsToShow = useMemo(() => {
    if (filteredScheduleItems.length > 0) return filteredScheduleItems;
    if (statusFilteredEntries.length === 0) return [];
    return sortEntries(statusFilteredEntries);
  }, [filteredScheduleItems, statusFilteredEntries, sortEntries]);

  const showingOtherDates = filteredScheduleItems.length === 0 && statusFilteredEntries.length > 0;

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

  const normalizeCareRecipient = (raw: any) =>
    Array.isArray(raw) ? (raw[0] || {}) : (raw || {});

  const renderScheduleItem = ({ item: entry }: { item: ScheduleEntry }) => {
    const { type, item } = entry;
    const careRecipient = normalizeCareRecipient(item.care_recipient);

    if (type === 'booking') {
      const serviceLabel = getServiceTypeLabel(item.service_type) || 'Booking';
      const slotInfo = formatSlotDateTime(item.scheduled_date) || 'Date not set';
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
              <Text style={styles.meta}>{slotInfo}</Text>
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
            <Text style={styles.meta}>{item.scheduled_time ? formatSlotDateTime(item.scheduled_time) : 'Date not set'}</Text>
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
    if (error && !loading) {
      return (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={THEME.subText} />
          <Text style={[styles.emptyText, { marginTop: 12 }]}>{error.message}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => { clearError(); fetchData(); }}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

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
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.contentWrap}>
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

        {/* Slot date range filter */}
      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>Slot date</Text>
        <View style={styles.filterRow}>
          {(['date', 'week', 'all'] as const).map((range) => (
            <TouchableOpacity
              key={range}
              style={[styles.filterChip, dateRange === range && styles.filterChipActive]}
              onPress={() => setDateRange(range)}
            >
              <Text style={[styles.filterChipText, dateRange === range && styles.filterChipTextActive]}>
                {range === 'date' ? selectedDate === todayStr ? 'Today' : 'Selected' : range === 'week' ? 'This week' : 'All'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Type filter: All | Assignments | Video calls */}
      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>Show</Text>
        <View style={styles.filterRow}>
          {(['all', 'assignments', 'video_calls'] as const).map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.filterChip, typeFilter === type && styles.filterChipActive]}
              onPress={() => setTypeFilter(type)}
            >
              <Ionicons
                name={type === 'all' ? 'list' : type === 'assignments' ? 'calendar' : 'videocam'}
                size={16}
                color={typeFilter === type ? '#fff' : THEME.subText}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.filterChipText, typeFilter === type && styles.filterChipTextActive]}>
                {type === 'all' ? 'All' : type === 'assignments' ? 'Assignments' : 'Video calls'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Status filter: All | Pending | Confirmed | In progress | Completed */}
      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>Status</Text>
        <View style={styles.filterRow}>
          {(['all', 'pending', 'confirmed', 'in_progress', 'completed'] as const).map((status) => (
            <TouchableOpacity
              key={status}
              style={[styles.filterChip, statusFilter === status && styles.filterChipActive]}
              onPress={() => setStatusFilter(status)}
            >
              <Ionicons
                name={
                  status === 'all' ? 'filter' :
                  status === 'pending' ? 'time' :
                  status === 'confirmed' ? 'checkmark-circle' :
                  status === 'in_progress' ? 'play-circle' : 'checkmark-done'
                }
                size={16}
                color={statusFilter === status ? '#fff' : THEME.subText}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.filterChipText, statusFilter === status && styles.filterChipTextActive]}>
                {status === 'all' ? 'All' : status === 'pending' ? 'Pending' : status === 'confirmed' ? 'Confirmed' : status === 'in_progress' ? 'In progress' : 'Completed'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

        <View style={styles.listWrap}>
          {renderContent()}
        </View>
      </View>

      <BottomNav />

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
  contentWrap: { flex: 1 },
  listWrap: { flex: 1, minHeight: 0 },
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
  filterSection: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.subText,
    marginBottom: 6,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  filterChipActive: {
    backgroundColor: THEME.primary,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.subText,
  },
  filterChipTextActive: {
    color: '#fff',
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
  retryButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: THEME.primary,
    borderRadius: 10,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
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
