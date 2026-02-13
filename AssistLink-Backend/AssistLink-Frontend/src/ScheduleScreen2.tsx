import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Modal,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

export default function ScheduleScreen2({ navigation }: any) {
  const { user } = useAuth();
  const [videoCalls, setVideoCalls] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const videoCallsData = await api.getDashboardVideoCalls({ limit: 100 });
      setVideoCalls(videoCallsData || []);
    } catch (e: any) {
      console.error("Failed to fetch schedule data:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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

  // Filter items by selected date
  const filteredVideoCalls = useMemo(() => {
    return videoCalls.filter((item) => {
      if (!item.scheduled_time) return false;
      const itemDate = formatDate(item.scheduled_time);
      return itemDate === selectedDate;
    });
  }, [videoCalls, selectedDate]);

  // Calendar markings
  const markedDates = useMemo(() => {
    const marks: any = {};

    videoCalls.forEach((item) => {
      const date = item.scheduled_time;
      if (!date) return;
      const dateStr = formatDate(date);
      if (!marks[dateStr]) {
        marks[dateStr] = { dots: [] };
      }
      const status = item.status || 'pending';
      marks[dateStr].dots.push({
        key: item.id,
        color: statusColor(status),
      });
    });

    marks[selectedDate] = {
      ...(marks[selectedDate] || {}),
      selected: true,
      selectedColor: THEME.primary,
    };

    return marks;
  }, [videoCalls, selectedDate]);

  const renderVideoCallItem = ({ item }: any) => {
    const careRecipient = item.care_recipient || {};

    return (
      <TouchableOpacity style={styles.card}>
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
            <Text style={styles.meta}>{formatTime(item.scheduled_time)}</Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusColor(item.status) + '33' },
            ]}
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

    if (filteredVideoCalls.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <Ionicons
            name="videocam-off"
            size={48}
            color={THEME.subText}
          />
          <Text style={styles.emptyText}>
            No video calls on this date
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={filteredVideoCalls}
        renderItem={renderVideoCallItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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
});
