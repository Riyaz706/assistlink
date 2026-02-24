import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Dimensions, Image, ActivityIndicator, Alert, ScrollView, RefreshControl } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomNav from './BottomNav';
import { api } from './api/client';
import { useErrorHandler, ErrorDetails } from './hooks/useErrorHandler';
import { getServiceTypeLabel } from './constants/labels';

const { width } = Dimensions.get('window');
const GREEN = "#059669";

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

const UpcomingVisitScreen = () => {
  const navigation = useNavigation();
  const { error, handleError, clearError } = useErrorHandler();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const loadUpcomingBooking = useCallback(async () => {
    try {
      clearError();
      const response = await api.getDashboardBookings({ upcoming_only: true, limit: 1 });
      if (response && Array.isArray(response) && response.length > 0) {
        setBooking(response[0]);
      } else {
        setBooking(null);
      }
    } catch (err: any) {
      handleError(err, 'fetch-upcoming-booking');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [handleError, clearError]);

  useEffect(() => {
    loadUpcomingBooking();
  }, [loadUpcomingBooking]);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    loadUpcomingBooking();
  }, [loadUpcomingBooking]);

  const handleCancelVisit = () => {
    if (!booking) return;

    Alert.alert(
      "Cancel Visit",
      "Are you sure you want to cancel this visit?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            setCancelling(true);
            try {
              await api.cancelBooking(booking.id);
              Alert.alert("Success", "Visit cancelled successfully");
              loadUpcomingBooking(); // Refresh to show empty state or next booking
            } catch (err: any) {
              handleError(err, 'cancel-booking');
            } finally {
              setCancelling(false);
            }
          }
        }
      ]
    );
  };

  const handleCallCaregiver = () => {
    // Check if phone number exists in caregiver profile (mock logic replacement)
    if (booking?.caregiver?.phone) {
      Alert.alert("Call Caregiver", `Calling ${booking.caregiver.phone}...`);
    } else {
      Alert.alert("Info", "Caregiver contact number not available.");
    }
  };

  const handleMessageCaregiver = () => {
    if (booking?.chat_session_id) {
      // Navigate to chat
      (navigation as any).navigate('ChatDetailScreen', {
        chatSessionId: booking.chat_session_id,
        otherUserName: booking.caregiver?.full_name || 'Caregiver'
      });
    } else {
      Alert.alert("Info", "Chat not enabled for this booking yet.");
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={GREEN} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* --- HEADER --- */}
      <SafeAreaView style={styles.headerContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-left" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Track Caregiver</Text>
          <View style={{ width: 24 }} />
        </View>
        <ErrorBanner error={error} onDismiss={clearError} />
      </SafeAreaView>

      {!booking ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Icon name="calendar-check-outline" size={64} color="#9CA3AF" />
          <Text style={styles.emptyText}>No upcoming visits found.</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <>
          {/* --- MAP PLACEHOLDER --- */}
          {/* Using mock map for now as real tracking requires complex backend websocket setup not in scope */}
          <View style={styles.mapContainer}>
            <View style={styles.mapPlaceholder}>
              <View style={styles.road} />
              <View style={[styles.road, { transform: [{ rotate: '90deg' }] }]} />

              <View style={styles.userLocation}>
                <View style={styles.userDot} />
              </View>

              <View style={styles.carLocation}>
                <Icon name="car" size={24} color="#fff" />
              </View>

              <Text style={styles.mapLabel}>
                {booking.location?.address || "Location Tracking Unavailable"}
              </Text>
            </View>
          </View>

          {/* --- BOTTOM SHEET INFO --- */}
          <ScrollView
            style={styles.bottomSheet}
            contentContainerStyle={{ paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            {/* Time Estimation */}
            <View style={styles.timeContainer}>
              <Text style={styles.timeText}>
                {new Date(booking.scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
              <Text style={styles.subTimeText}>
                {new Date(booking.scheduled_date).toDateString()} • {booking.status === 'in_progress' ? 'In Progress' : 'Scheduled'}
              </Text>
            </View>

            {/* Progress Bar (Mock for now) */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: booking.status === 'in_progress' ? '50%' : '0%' }]} />
              </View>
            </View>

            {/* Caregiver Profile */}
            <View style={styles.profileRow}>
              <Image
                source={{ uri: booking.caregiver?.profile_photo_url || 'https://randomuser.me/api/portraits/men/32.jpg' }}
                style={styles.avatar}
              />
              <View style={styles.profileInfo}>
                <Text style={styles.caregiverName}>
                  {booking.caregiver?.full_name || "Assigned Caregiver"}
                </Text>
                <View style={styles.ratingRow}>
                  <Icon name="star" size={14} color="#FBBF24" />
                  <Text style={styles.ratingText}>
                    {booking.caregiver?.rating || "5.0"} • {getServiceTypeLabel(booking.service_type)}
                  </Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actions}>
                <TouchableOpacity style={styles.iconBtn} onPress={handleMessageCaregiver}>
                  <Icon name="message-processing-outline" size={22} color={GREEN} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.iconBtn, styles.callBtn]} onPress={handleCallCaregiver}>
                  <Icon name="phone" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.cancelButton, cancelling && { opacity: 0.5 }]}
              onPress={handleCancelVisit}
              disabled={cancelling}
            >
              {cancelling ? (
                <ActivityIndicator color="#EF4444" />
              ) : (
                <Text style={styles.cancelText}>Cancel Visit</Text>
              )}
            </TouchableOpacity>

          </ScrollView>
        </>
      )}
      <BottomNav />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContainer: {
    backgroundColor: '#fff',
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
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
  // Map Styling
  mapContainer: {
    flex: 1,
    backgroundColor: '#E5E7EB',
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#EBF4EF', // Light green tint
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  road: {
    position: 'absolute',
    width: '100%',
    height: 40,
    backgroundColor: '#fff',
    borderColor: '#D1D5DB',
    borderTopWidth: 2,
    borderBottomWidth: 2,
  },
  userLocation: {
    position: 'absolute',
    top: '30%',
    left: '50%',
    width: 24,
    height: 24,
    backgroundColor: 'rgba(5, 150, 105, 0.3)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userDot: {
    width: 12,
    height: 12,
    backgroundColor: GREEN,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  carLocation: {
    position: 'absolute',
    bottom: '40%',
    right: '30%',
    width: 40,
    height: 40,
    backgroundColor: '#111827',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  mapLabel: {
    position: 'absolute',
    bottom: 20,
    color: '#9CA3AF',
    fontWeight: '600',
  },

  // Bottom Sheet Styling
  bottomSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
    padding: 20,
    flexGrow: 0,
    flexBasis: 'auto'
  },
  timeContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  timeText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  subTimeText: {
    color: '#6B7280',
    fontSize: 14,
    marginTop: 4,
    textTransform: 'capitalize'
  },
  progressContainer: {
    marginBottom: 24,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    width: '100%',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: GREEN,
    borderRadius: 3,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  profileInfo: {
    flex: 1,
  },
  caregiverName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  ratingText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
    textTransform: 'capitalize'
  },
  actions: {
    flexDirection: 'row',
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  callBtn: {
    backgroundColor: GREEN,
    shadowColor: GREEN,
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  cancelButton: {
    paddingVertical: 14,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    marginTop: 10,
  },
  cancelText: {
    color: '#EF4444',
    fontWeight: '600',
    fontSize: 15,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 100,
  },
  emptyText: {
    fontSize: 18,
    color: '#6B7280',
    marginTop: 20,
    textAlign: 'center',
  },
  refreshButton: {
    marginTop: 20,
    padding: 10,
    backgroundColor: GREEN,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: '#FFF',
    fontWeight: '600',
  }
});

export default UpcomingVisitScreen;