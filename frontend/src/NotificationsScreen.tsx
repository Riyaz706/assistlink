import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, StatusBar, Dimensions, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { api } from './api/client';
import { useAuth } from './context/AuthContext';
import { useNotification } from './context/NotificationContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useErrorHandler } from './hooks/useErrorHandler';
import { getSupabase } from './lib/supabase';
import BottomNav from './BottomNav';

const { width } = Dimensions.get('window');

// --- COLORS ---
const COLORS = {
  background: '#FFFFFF',
  primaryGreen: '#059669',
  darkText: '#1A1A1A',
  grayText: '#7A7A7A',
  lightGray: '#F5F7FA',
  divider: '#F0F0F0',
  red: '#FF4444'
};

/** Format notification created_at (ISO or date string) to readable date and time. */
function formatNotificationDate(createdAt: string | undefined | null): string {
  if (createdAt == null || createdAt === '') return '';
  if (typeof createdAt !== 'string') return '';
  // Already human-readable (e.g. from NotificationContext: "Feb 21, 2026 at 2:30 PM")
  if (createdAt.includes(' at ') || !/^\d{4}-\d{2}-\d{2}/.test(createdAt)) return createdAt;
  try {
    const d = new Date(createdAt);
    if (Number.isNaN(d.getTime())) return '';
    const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${dateStr}, ${timeStr}`;
  } catch {
    return '';
  }
}

const NotificationsScreen = ({ navigation }: any) => {
  const { user, loading: authLoading, accessToken } = useAuth();
  const isCaregiver = user?.role === 'caregiver' || (user as any)?.user_metadata?.role === 'caregiver';
  const [activeTab, setActiveTab] = useState('All');
  const tabs = ['All', 'Requests', 'Updates', 'Messages'];
  const hasSetCaregiverDefault = useRef(false);

  // For caregiver (caretaker): default to "Requests" tab so they see new booking/video call requests first
  useEffect(() => {
    if (isCaregiver && !hasSetCaregiverDefault.current) {
      hasSetCaregiverDefault.current = true;
      setActiveTab('Requests');
    }
  }, [isCaregiver]);
  const { refresh: refreshNotificationContext } = useNotification();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { handleError, error, clearError } = useErrorHandler();
  const realtimeChannelRef = useRef<{ unsubscribe: () => void } | null>(null);
  const lastLoadRef = useRef<number>(0);
  const hasLoadedOnceRef = useRef(false);
  const MIN_REFRESH_INTERVAL_MS = 3000;

  const loadNotifications = async () => {
    // Don't try to load if auth is still loading or if there's no token
    if (authLoading || !accessToken) {
      console.log('[Notifications] Skipping load - authLoading:', authLoading, 'hasToken:', !!accessToken);
      return;
    }

    console.log('[Notifications] Loading notifications...');
    setLoading(true);
    clearError();
    try {
      const data = await api.getNotifications({ limit: 50, offset: 0 }) as unknown[] | { data?: unknown[]; notifications?: unknown[] };
      const list = Array.isArray(data) ? data : (data?.data ?? data?.notifications ?? []);
      console.log('[Notifications] Loaded', list.length, 'notifications');
      setItems(list);
    } catch (e: any) {
      handleError(e, 'notifications-load');
    } finally {
      setLoading(false);
      hasLoadedOnceRef.current = true;
    }
  };

  const handleNotificationTap = async (notification: any) => {
    try {
      // Mark as read
      if (!notification.is_read) {
        await api.markNotificationRead(notification.id);
      }

      // Navigate based on type and data
      const { type, data } = notification;

      switch (type) {
        case 'message':
        case 'chat_session':
          if (data?.chat_session_id) {
            navigation.navigate('ChatDetailsScreen', {
              chatSessionId: data.chat_session_id
            });
          }
          break;

        case 'video_call':
          if (data?.video_call_id) {
            navigation.navigate('VideoCallScreen', {
              callId: data.video_call_id
            });
          }
          break;

        case 'booking':
          if (data?.booking_id) {
            navigation.navigate('BookingDetailScreen', { bookingId: data.booking_id });
          }
          break;

        case 'emergency':
          if (data?.emergency_id) {
            navigation.navigate('EmergencyScreen', {
              emergency_id: data.emergency_id,
              notification: {
                data: {
                  emergency_id: data.emergency_id,
                  location: data.location,
                  care_recipient_name: data.care_recipient_name,
                },
              },
            });
          } else {
            navigation.navigate('EmergencyScreen');
          }
          break;

        default:
          // Just mark as read
          break;
      }

      // Reload notifications to update UI
      await loadNotifications();
    } catch (error) {
      handleError(error, 'notification-tap');
    }
  };

  useEffect(() => {
    if (!authLoading && accessToken) {
      loadNotifications();
    }
  }, [authLoading, accessToken]);

  // Real-time: subscribe to new notifications for this user so list updates immediately
  useEffect(() => {
    if (!user?.id || authLoading || !accessToken) return;
    const supabase = getSupabase();
    const userId = String(user.id);
    if (!supabase) return;
    try {
      const channel = supabase
        .channel(`notifications-list:${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          () => {
            loadNotifications();
          }
        )
        .subscribe();
      realtimeChannelRef.current = channel;
      return () => {
        if (realtimeChannelRef.current?.unsubscribe) realtimeChannelRef.current.unsubscribe();
        realtimeChannelRef.current = null;
      };
    } catch (e) {
      console.warn('[NotificationsScreen] Realtime subscribe failed:', e);
    }
  }, [user?.id, authLoading, accessToken]);

  // Refresh when screen is focused, but not more than once per MIN_REFRESH_INTERVAL_MS to avoid constant refresh
  useFocusEffect(
    React.useCallback(() => {
      if (!authLoading && accessToken) {
        const now = Date.now();
        const shouldLoad = !hasLoadedOnceRef.current || (now - lastLoadRef.current >= MIN_REFRESH_INTERVAL_MS);
        if (shouldLoad) {
          lastLoadRef.current = now;
          loadNotifications();
          refreshNotificationContext(true);
        }
        return () => clearError();
      }
    }, [authLoading, accessToken, refreshNotificationContext])
  );

  const renderNotificationItem = (item: any) => {
    const type = item.type || 'update';
    const bookingStatus = item.data?.booking_status ?? item.data?.status ?? '';
    const isAccepted = type === 'booking' && ['accepted', 'confirmed', 'in_progress', 'completed'].includes(String(bookingStatus).toLowerCase());
    const isDeclined = type === 'booking' && String(bookingStatus).toLowerCase() === 'cancelled';
    const title = isAccepted ? 'Accepted' : isDeclined ? 'Declined' : (item.title || 'Notification');
    const content = isAccepted ? 'You accepted this booking request.' : isDeclined ? 'You declined this booking request.' : (item.message || item.body || item.content || '');
    const createdAt = item.created_at || item.time;
    const isUnread = item.is_read === false || item.unread;

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.card}
        onPress={() => handleNotificationTap(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardContentRow}>

          {/* --- ICON / AVATAR AREA --- */}
          <View style={styles.iconContainer}>
            {type === 'request' || type === 'message' || type === 'review' || type === 'video_call' || type === 'booking' || type === 'emergency' ? (
              <View>
                {item.avatar ? (
                  <Image
                    source={{ uri: item.avatar }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={[styles.avatarPlaceholder, type === 'emergency' && { backgroundColor: '#FEE2E2' }]}>
                    <MaterialCommunityIcons
                      name={type === 'emergency' ? "alert-decagram" : "account"}
                      size={24}
                      color={type === 'emergency' ? COLORS.red : "#6B7280"}
                    />
                  </View>
                )}
                {type === 'request' && (
                  <View style={styles.miniBadgeBlue}><Ionicons name="briefcase" size={10} color="#FFF" /></View>
                )}
                {type === 'video_call' && (
                  <View style={styles.miniBadgeBlue}><Ionicons name="videocam" size={10} color="#FFF" /></View>
                )}
                {type === 'booking' && (
                  <View style={styles.miniBadgeBlue}><Ionicons name="calendar" size={10} color="#FFF" /></View>
                )}
                {type === 'message' && (
                  <View style={styles.miniBadgeGreen}><Ionicons name="chatbubble" size={10} color="#FFF" /></View>
                )}
                {type === 'emergency' && (
                  <View style={[styles.miniBadgeBlue, { backgroundColor: COLORS.red }]}><Ionicons name="warning" size={10} color="#FFF" /></View>
                )}
              </View>
            ) : (
              <View style={[styles.iconCircle, { backgroundColor: item.iconBg || '#F5F5F5' }]}>
                <MaterialCommunityIcons
                  name={item.icon || 'bell'}
                  size={24}
                  color={item.iconColor || COLORS.primaryGreen}
                />
              </View>
            )}
          </View>

          {/* --- TEXT CONTENT --- */}
          <View style={styles.textContainer}>
            <View style={styles.headerRow}>
              <Text style={[styles.itemTitle, type === 'emergency' && { color: COLORS.red }]}>{title}</Text>
              {isUnread && <View style={styles.unreadDot} />}
            </View>

            {/* Rating Stars for Review */}
            {type === 'review' && (
              <View style={styles.ratingRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Ionicons key={star} name="star" size={14} color="#FFD700" style={{ marginRight: 2 }} />
                ))}
              </View>
            )}

            <Text style={styles.itemContent} numberOfLines={2}>
              {item.user ? <Text style={styles.boldName}>{item.user} </Text> : null}
              {content}
            </Text>
            <Text style={styles.timeText}>
              {formatNotificationDate(createdAt)}
            </Text>
          </View>
        </View>

      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.contentWrap}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.darkText} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {isCaregiver && (
            <Text style={styles.headerSubtitle}>Requests & updates</Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={loadNotifications}>
            <Ionicons name="refresh" size={20} color={COLORS.primaryGreen} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={async () => {
              try {
                await api.markAllNotificationsRead();
                await loadNotifications();
              } catch (e) {
                handleError(e, 'mark-all-read');
              }
            }}
          >
            <Text style={styles.markReadText}>Mark all read</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.activeTab]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading && (
        <View style={{ padding: 20 }}>
          <ActivityIndicator color={COLORS.primaryGreen} />
        </View>
      )}

      {/* Error Banner */}
      {error && (
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle" size={20} color="#FFF" />
          <Text style={styles.errorText} numberOfLines={2}>
            {error.message || "Failed to load notifications"}
          </Text>
          <TouchableOpacity onPress={clearError}>
            <MaterialCommunityIcons name="close" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* Filter items by tab */}
      {(() => {
        const TERMINAL_BOOKING_STATUSES = ['accepted', 'confirmed', 'in_progress', 'completed', 'cancelled'];
        const isBookingPending = (item: any) => {
          const status = item.data?.status ?? item.data?.booking_status ?? '';
          return !TERMINAL_BOOKING_STATUSES.includes(String(status).toLowerCase());
        };
        const filtered = items.filter((item) => {
          const type = item.type || 'update';
          if (activeTab === 'Requests') {
            if (type === 'emergency') return true;
            if (type === 'request' || type === 'video_call') return true;
            // Only show booking notifications that are actual pending requests (New Booking Request, not yet accepted/completed)
            if (type === 'booking') {
              const isNewRequest = (item.title || '').toLowerCase().includes('new booking request');
              return isNewRequest && isBookingPending(item);
            }
            return false;
          }
          if (activeTab === 'Messages') {
            return type === 'message' || type === 'chat_session';
          }
          if (activeTab === 'Updates') {
            if (type === 'message' || type === 'chat_session' || type === 'request') return false;
            if (type === 'video_call') return false;
            // Show booking status updates (accepted, declined, cancelled) and other update types
            if (type === 'booking') {
              const status = String(item.data?.booking_status ?? item.data?.status ?? '').toLowerCase();
              return ['accepted', 'cancelled', 'completed'].includes(status) ||
                (item.title || '').toLowerCase().includes('accepted') ||
                (item.title || '').toLowerCase().includes('declined') ||
                (item.title || '').toLowerCase().includes('status update');
            }
            return true; // other types (e.g. generic update)
          }
          return true; // All
        });

        return (
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.listContent}>
            <Text style={styles.sectionHeader}>{activeTab.toUpperCase()}</Text>
            {filtered.map(renderNotificationItem)}
          </ScrollView>
        );
      })()}
      </View>
      <BottomNav />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  contentWrap: { flex: 1 },
  scrollView: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    paddingRight: 10,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.darkText,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.grayText,
    marginTop: 2,
  },
  markReadText: {
    color: COLORS.primaryGreen,
    fontWeight: '600',
    fontSize: 14,
  },
  tabsContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
  },
  tabsScroll: {
    paddingHorizontal: 20,
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 12,
  },
  activeTab: {
    backgroundColor: COLORS.primaryGreen,
  },
  tabText: {
    color: '#666',
    fontWeight: '600',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 20,
    paddingTop: 10,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#999',
    marginBottom: 10,
    marginTop: 10,
    letterSpacing: 1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  cardContentRow: {
    flexDirection: 'row',
  },
  iconContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniBadgeBlue: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#4A90E2',
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  miniBadgeGreen: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.primaryGreen,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.darkText,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primaryGreen,
  },
  ratingRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  itemContent: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  boldName: {
    fontWeight: '700',
    color: COLORS.darkText,
  },
  timeText: {
    fontSize: 11,
    color: '#999',
    marginTop: 6,
  },
  // Error Styles
  errorContainer: {
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 8,
  },
  errorText: {
    color: '#FFF',
    flex: 1,
    marginHorizontal: 8,
    fontSize: 13,
    fontWeight: '500',
  },
});

export default NotificationsScreen;