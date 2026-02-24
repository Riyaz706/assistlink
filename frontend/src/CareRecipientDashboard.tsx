import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  RefreshControl,
  StatusBar,
  Platform,
  Modal,
  TextInput,
  Animated,
  KeyboardAvoidingView,
  Keyboard,
  Pressable,
  PanResponder,
  Dimensions,
  Alert
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import BottomNav from './BottomNav';
import WeatherWidget from './components/WeatherWidget';
import { useAuth } from './context/AuthContext';
import { useTranslation } from 'react-i18next';
import { api } from './api/client';
import { useErrorHandler } from './hooks/useErrorHandler';
import { colors, typography, spacing, layout, borderRadius, shadows } from './theme';
import { getServiceTypeLabel } from './constants/labels';

// --- TYPES ---
import { useNavigation, NavigationProp } from '@react-navigation/native';

// Define the route names here so TypeScript doesn't complain
type RootStackParamList = {
  UpcomingVisitScreen: undefined; // <--- MATCHES App.js name
  CaregiverMapScreen: {
    recipientLocation?: { latitude: number; longitude: number };
    recipientName?: string;
    caregiverName?: string;
  };
  NewRequestScreen: undefined;
  EmergencyScreen: undefined;
  Notifications: undefined;
  Profile: undefined;
  Schedule: undefined;
  Settings: undefined;
  HelpSupport: undefined;
  NSSPortal: undefined;
  // add others if needed
};

const GREEN = colors.secondary;
const RED = colors.error;

/** Human-readable label and color for booking status in Current Status section */
function getBookingStatusDisplay(status: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    requested: { label: 'Request sent', color: '#6B7280' },
    pending: { label: 'Awaiting response', color: '#F59E0B' },
    accepted: { label: 'Accepted', color: '#2563EB' },
    confirmed: { label: 'Confirmed', color: '#059669' },
    in_progress: { label: 'In progress', color: '#059669' },
    completed: { label: 'Completed', color: '#6B7280' },
    cancelled: { label: 'Cancelled', color: '#DC2626' },
    rejected: { label: 'Declined', color: '#DC2626' },
    declined: { label: 'Declined', color: '#DC2626' },
    missed: { label: 'Missed', color: '#DC2626' },
  };
  return map[(status || '').toLowerCase()] || { label: (status || 'Unknown').replace(/_/g, ' '), color: '#6B7280' };
}
const SWIPE_HEIGHT = 56;
const SCREEN_WIDTH = Dimensions.get('window').width;
const BUTTON_WIDTH = SCREEN_WIDTH - 32;

// ... [SosSwipeButton code remains the same] ...
const SosSwipeButton = ({ onSwipeSuccess }: { onSwipeSuccess: () => void }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const MAX_SLIDE = BUTTON_WIDTH - 50 - 10;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        const newX = Math.max(0, Math.min(MAX_SLIDE, gestureState.dx));
        translateX.setValue(newX);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > MAX_SLIDE * 0.7) {
          Animated.spring(translateX, {
            toValue: MAX_SLIDE,
            useNativeDriver: true,
            bounciness: 0
          }).start(() => {
            onSwipeSuccess();
            setTimeout(() => {
              Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
            }, 1000);
          });
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true
          }).start();
        }
      }
    })
  ).current;

  const textOpacity = translateX.interpolate({
    inputRange: [0, MAX_SLIDE / 2],
    outputRange: [1, 0],
    extrapolate: 'clamp'
  });

  return (
    <View style={styles.swipeContainer}>
      <Animated.View style={[styles.swipeTextContainer, { opacity: textOpacity }]}>
        <Text style={styles.swipeText}>Swipe for Emergency SOS {'>>'}</Text>
      </Animated.View>

      <Animated.View
        style={[styles.swipeKnob, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
        accessibilityLabel="Slide to send Emergency SOS"
        accessibilityRole="button"
        accessibilityHint="Slides the button to the right to trigger an emergency alert"
      >
        <Icon name="alert-octagon" size={24} color={RED} />
      </Animated.View>
    </View>
  );
};


const CareRecipientDashboard = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { t } = useTranslation();
  const { user, refreshUser, logout } = useAuth();
  const { handleError } = useErrorHandler();

  // --- STATE ---
  const [currentDate, setCurrentDate] = useState("");
  const [greeting, setGreeting] = useState("Good Morning");
  // Show modal only if emergency contact is not set
  const [showSosModal, setShowSosModal] = useState(false);
  const [caretakerName, setCaretakerName] = useState("");
  const [caretakerPhone, setCaretakerPhone] = useState("");
  const [currentBookings, setCurrentBookings] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [unratedBooking, setUnratedBooking] = useState<any>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const scaleValue = useRef(new Animated.Value(0)).current;

  const loadCurrentBookings = async (isRetry = false) => {
    try {
      setLoadingBookings(true);
      // Load active bookings directly from API
      const bookings = await api.getDashboardBookings({
        limit: 20,
        status: 'requested,pending,accepted,in_progress' // requested = sent, waiting for caregiver
      });
      // Filter to only show active bookings (requested, pending, accepted, or in_progress - not completed/cancelled)
      const active = ((bookings as any[]) || []).filter((b: any) =>
        b.status === 'requested' || b.status === 'pending' || b.status === 'accepted' || b.status === 'in_progress'
      );

      // Remove duplicates - keep only the most recent booking for each caregiver
      const uniqueBookings = active.reduce((acc: any[], booking: any) => {
        const caregiverId = booking.caregiver_id || booking.caregiver?.id;
        if (!caregiverId) {
          acc.push(booking);
          return acc;
        }

        // Check if we already have a booking for this caregiver
        const existingIndex = acc.findIndex((b: any) =>
          (b.caregiver_id || b.caregiver?.id) === caregiverId
        );

        if (existingIndex === -1) {
          // No existing booking for this caregiver, add it
          acc.push(booking);
        } else {
          // Compare dates - keep the one with later scheduled_date
          const existing = acc[existingIndex];
          const existingDate = existing.scheduled_date ? new Date(existing.scheduled_date) : new Date(0);
          const newDate = booking.scheduled_date ? new Date(booking.scheduled_date) : new Date(0);

          if (newDate > existingDate) {
            // Replace with newer booking
            acc[existingIndex] = booking;
          }
        }

        return acc;
      }, []);

      setCurrentBookings(uniqueBookings);

      // Find a completed booking that hasn't been rated (for "Rate your caregiver" prompt)
      try {
        const completed = await api.getDashboardBookings({ status: 'completed', limit: 5 });
        const list = (completed as any[]) || [];
        let found: any = null;
        for (const b of list) {
          const review = await api.getBookingReview(b.id).catch(() => null);
          if (!review) {
            found = b;
            break;
          }
        }
        setUnratedBooking(found);
      } catch {
        setUnratedBooking(null);
      }

      // Recent activity feed: bookings + chat sessions
      try {
        const [allBookingsRes, chatRes] = await Promise.all([
          api.getDashboardBookings({ limit: 10 }),
          api.getChatSessions().catch(() => []),
        ]);
        const allBookings = (allBookingsRes as any[]) || [];
        const sessions = (chatRes as any[]) || [];
        const items: { type: 'booking' | 'chat'; date: Date; label: string; data: any }[] = [];
        allBookings.slice(0, 5).forEach((b: any) => {
          const d = b.updated_at || b.scheduled_date || b.created_at;
          const caregiverName = b.caregiver?.full_name || 'Caregiver';
          const status = b.status || 'pending';
          items.push({
            type: 'booking',
            date: d ? new Date(d) : new Date(0),
            label: `${getServiceTypeLabel(b.service_type)} with ${caregiverName} · ${getBookingStatusDisplay(status).label}`,
            data: b,
          });
        });
        sessions.slice(0, 3).forEach((s: any) => {
          const other = s.caregiver || s.care_recipient || {};
          const name = other.full_name || 'User';
          const d = s.last_message_at || s.created_at;
          items.push({
            type: 'chat',
            date: d ? new Date(d) : new Date(0),
            label: `Chat with ${name}`,
            data: s,
          });
        });
        items.sort((a, b) => b.date.getTime() - a.date.getTime());
        setRecentActivity(items.slice(0, 5));
      } catch {
        setRecentActivity([]);
      }
    } catch (e: any) {
      const msg = (e?.message || '').toLowerCase();
      const isTemporary =
        msg.includes('temporarily unavailable') ||
        msg.includes('try again in a moment') ||
        e?.statusCode === 503 ||
        e?.code === 'TIMEOUT' ||
        e?.statusCode === 408;
      if (!isRetry && isTemporary) {
        // Backend may be cold-starting (e.g. Render). Retry once after a short delay.
        setTimeout(() => loadCurrentBookings(true), 3000);
        return;
      }
      handleError(e, 'load-bookings');
    } finally {
      setLoadingBookings(false);
    }
  };

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long', month: 'short', day: 'numeric'
      };
      const dateString = now.toLocaleDateString('en-US', options).toUpperCase();
      setCurrentDate(dateString);

      const hour = now.getHours();
      if (hour >= 5 && hour < 12) setGreeting("Good Morning");
      else if (hour >= 12 && hour < 17) setGreeting("Good Afternoon");
      else if (hour >= 17 && hour < 21) setGreeting("Good Evening");
      else setGreeting("Good Night");
    };

    updateTime();
    const timer = setInterval(updateTime, 60000);

    // Check if emergency contact is set, show modal if not
    if (user && !user.emergency_contact) {
      setShowSosModal(true);
    }

    if (showSosModal) {
      Animated.spring(scaleValue, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }).start();
    }

    loadCurrentBookings();
    return () => clearInterval(timer);
  }, [showSosModal, user]);

  // Reload bookings when screen is focused (e.g., after payment or completion)
  useFocusEffect(
    React.useCallback(() => {
      loadCurrentBookings();
    }, [])
  );

  const handleMarkCompleted = async (bookingId: string) => {
    try {
      await api.completeBooking(bookingId);
      await loadCurrentBookings();
      Alert.alert(
        "Visit completed",
        "Would you like to rate your caregiver? Your feedback helps others choose the best care.",
        [
          { text: "Later" },
          {
            text: "Rate now",
            onPress: () => (navigation as any).navigate('BookingDetailScreen', { bookingId }),
          },
        ]
      );
    } catch (e: any) {
      handleError(e, 'mark-completed');
    }
  };

  const handleNewRequest = () => {
    navigation.navigate('NewRequestScreen');
  };

  const handleEmergencySwipe = () => {
    navigation.navigate('EmergencyScreen');
  };

  const handleCloseModal = () => {
    setShowSosModal(false);
  };

  const handleMenuAction = (action: string) => {
    setMenuVisible(false);
    if (action === 'Emergency') navigation.navigate('EmergencyScreen');
    else if (action === 'Settings') navigation.navigate('Settings');
    else if (action === 'HelpSupport') navigation.navigate('HelpSupport');
    else if (action === 'Feedback') navigation.navigate('HelpSupport');
    else if (action === 'NSSPortal') navigation.navigate('NSSPortal');
    else if (action === 'Logout') {
      logout().catch((e: any) => handleError(e, 'logout'));
    }
  };

  const handleSaveContact = async () => {
    if (!caretakerName.trim() || !caretakerPhone.trim()) {
      Alert.alert("Error", "Please enter both name and phone number");
      return;
    }

    try {
      // Save emergency contact to user profile
      await api.updateProfile({
        emergency_contact: {
          name: caretakerName.trim(),
          phone: caretakerPhone.trim()
        }
      });

      // Refresh user data to get updated emergency contact
      if (refreshUser) {
        await refreshUser();
      }

      setShowSosModal(false);
      Alert.alert("Success", "Emergency contact saved successfully!");
    } catch (e: any) {
      handleError(e, 'save-contact');
      // Alert.alert("Error", e?.message || "Failed to save emergency contact. Please try again.");
    }
  };

  const displayName = user?.full_name || "Guest";
  const firstName = displayName.split(" ")[0] || displayName;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {/* --- SOS CONFIGURATION MODAL --- */}
      <Modal
        transparent={true}
        visible={showSosModal}
        animationType="fade"
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <Pressable onPress={Keyboard.dismiss} style={styles.modalOverlayTouchable} />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.keyboardView}
          >
            <Animated.View style={[styles.modalContent, { transform: [{ scale: scaleValue }] }]}>

              <TouchableOpacity
                style={styles.closeBtn}
                onPress={handleCloseModal}
                accessibilityLabel="Close"
                accessibilityRole="button"
              >
                <Icon name="close" size={20} color="#999" />
              </TouchableOpacity>

              <View style={styles.modalHeader}>
                <View style={styles.modalIconBg}>
                  <Icon name="ambulance" size={28} color={RED} />
                </View>
                <Text style={styles.modalTitle}>Emergency Setup</Text>
              </View>

              <Text style={styles.modalDesc}>
                Please enter your emergency contact's name and mobile number. This contact does not need to be a user of this app. We will use this for <Text style={{ fontWeight: '700', color: RED }}>SOS</Text> emergency calls.
              </Text>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Caretaker Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. John Doe"
                  placeholderTextColor="#9CA3AF"
                  value={caretakerName}
                  onChangeText={setCaretakerName}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Mobile Number</Text>
                <View style={styles.phoneInputRow}>
                  <View style={styles.countryCode}>
                    <Text style={styles.countryText}>🇮🇳 +91</Text>
                  </View>
                  <TextInput
                    style={styles.phoneInput}
                    placeholder="98765 43210"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={caretakerPhone}
                    onChangeText={setCaretakerPhone}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleSaveContact}
                accessibilityLabel="Confirm and save contact"
                accessibilityRole="button"
              >
                <Text style={styles.confirmBtnText}>Confirm & Save</Text>
              </TouchableOpacity>

            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <View style={styles.contentWrap}>
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={loadingBookings}
              onRefresh={loadCurrentBookings}
              colors={[GREEN]}
            />
          }
        >

        {/* HEADER — Clear greeting, date, menu, notifications */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => setMenuVisible(true)}
            style={styles.menuButton}
            activeOpacity={0.7}
            accessibilityLabel="Open menu"
            accessibilityRole="button"
          >
            <Icon name="menu" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.dateLabel}>{currentDate}</Text>
            <Text style={styles.greeting}>
              {greeting}, {firstName}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.bell}
            onPress={() => navigation.navigate('Notifications')}
            activeOpacity={0.7}
            accessibilityLabel="View notifications"
            accessibilityRole="button"
          >
            <Icon name="bell-outline" size={26} color={colors.textPrimary} />
            <View style={styles.notificationDot} />
          </TouchableOpacity>
        </View>

        {/* Hamburger Menu Modal - PRD: Emergency, NSS Portal, Settings, Help, Feedback, Logout */}
        <Modal visible={menuVisible} transparent animationType="fade">
          <Pressable style={styles.menuOverlay} onPress={() => setMenuVisible(false)}>
            <View style={styles.menuPanel}>
              <View style={styles.menuHeader}>
                <Text style={styles.menuTitle}>Menu</Text>
                <TouchableOpacity onPress={() => setMenuVisible(false)} delayPressIn={0} activeOpacity={0.6}>
                  <Icon name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuAction('Emergency')} delayPressIn={0} activeOpacity={0.6}>
                <Icon name="alert-octagon" size={22} color={colors.error} />
                <Text style={styles.menuItemText}>Emergency Services</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuAction('NSSPortal')} delayPressIn={0} activeOpacity={0.6}>
                <Icon name="school" size={22} color={colors.primary} />
                <Text style={styles.menuItemText}>NSS Portal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuAction('Settings')} delayPressIn={0} activeOpacity={0.6}>
                <Icon name="cog" size={22} color={colors.textPrimary} />
                <Text style={styles.menuItemText}>Settings</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuAction('HelpSupport')} delayPressIn={0} activeOpacity={0.6}>
                <Icon name="help-circle" size={22} color={colors.primary} />
                <Text style={styles.menuItemText}>Help & Support</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuAction('Feedback')} delayPressIn={0} activeOpacity={0.6}>
                <Icon name="message-reply-text" size={22} color={colors.accent} />
                <Text style={styles.menuItemText}>Feedback</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.menuItem, styles.menuItemLogout]} onPress={() => handleMenuAction('Logout')} delayPressIn={0} activeOpacity={0.6}>
                <Icon name="logout" size={22} color={colors.error} />
                <Text style={styles.menuItemTextLogout}>Logout</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>

        {/* Weather Widget */}
        <View style={styles.weatherWrap}>
          <WeatherWidget
            lat={(user as any)?.address?.latitude ?? 17.385}
            lng={(user as any)?.address?.longitude ?? 78.4867}
          />
        </View>

        {/* Primary Action Cards — Large touch targets, clear hierarchy */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickActionCard} onPress={() => navigation.navigate('NewRequestScreen')} activeOpacity={0.8}>
            <View style={[styles.quickActionIcon, { backgroundColor: colors.primaryLight }]}>
              <Icon name="plus-circle" size={32} color={colors.primary} />
            </View>
            <Text style={styles.quickActionLabel}>Request Help</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionCard} onPress={() => (navigation as any).navigate('Schedule')} activeOpacity={0.8}>
            <View style={[styles.quickActionIcon, { backgroundColor: colors.secondaryLight }]}>
              <Icon name="calendar-clock" size={32} color={colors.secondary} />
            </View>
            <Text style={styles.quickActionLabel}>Schedule Care</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionCard} onPress={handleEmergencySwipe} activeOpacity={0.8}>
            <View style={[styles.quickActionIcon, { backgroundColor: '#FEE2E2' }]}>
              <Icon name="alert-octagon" size={32} color={colors.error} />
            </View>
            <Text style={styles.quickActionLabel}>Emergency</Text>
          </TouchableOpacity>
        </View>

        {/* PROFILE CARD */}
        <TouchableOpacity
          style={styles.profileCard}
          activeOpacity={0.6}
          onPress={() => navigation.navigate('Profile')}
          accessibilityLabel="Open profile"
          accessibilityRole="button"
          delayPressIn={0}
        >
          <View style={styles.profileLeft}>
            <View style={styles.avatarWrapper}>
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
              <View style={styles.percentBadge}>
                <Text style={styles.percentText}>98%</Text>
              </View>
            </View>

            <View>
              <Text style={styles.name}>{displayName}</Text>
              <Text style={styles.link}>View Profile & Health ID</Text>
            </View>
          </View>
          <Icon name="chevron-right" size={24} color="#999" />
        </TouchableOpacity>

        {/* REQUEST CARE BUTTON */}
        <TouchableOpacity
          style={styles.requestBtn}
          activeOpacity={0.7}
          onPress={handleNewRequest}
          delayPressIn={0}
          accessibilityLabel="Request New Caregiver Service"
          accessibilityRole="button"
        >
          <Icon name="plus" size={22} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.requestText}>{t('dashboard.requestNewCare')}</Text>
        </TouchableOpacity>

        {/* SOS SWIPE BUTTON */}
        <SosSwipeButton onSwipeSuccess={handleEmergencySwipe} />

        {/* ACTIVE CAREGIVER STATUS - PRD */}
        {currentBookings.some((b: any) => b.status === 'in_progress') && (() => {
          const activeBooking = currentBookings.find((b: any) => b.status === 'in_progress');
          const cg = activeBooking?.caregiver || {};
          return (
            <View style={styles.activeCaregiverBanner}>
              <Icon name="account-check" size={24} color={GREEN} />
              <View style={styles.activeCaregiverTextWrap}>
                <Text style={styles.activeCaregiverLabel}>{t('dashboard.activeCaregiver')}</Text>
                <Text style={styles.activeCaregiverName}>{cg.full_name || 'Caregiver'} · {t('dashboard.visitInProgress')}</Text>
              </View>
            </View>
          );
        })()}

        {/* RECENT ACTIVITY FEED - PRD */}
        <View style={styles.recentActivitySection}>
          <Text style={styles.sectionTitle}>{t('dashboard.recentActivity')}</Text>
          {recentActivity.length > 0 ? (
            <View style={styles.recentActivityCard}>
              {recentActivity.map((item, i) => (
                <TouchableOpacity
                  key={`${item.type}-${i}`}
                  style={[styles.recentActivityItem, i < recentActivity.length - 1 && styles.recentActivityBorder]}
                  onPress={() => {
                    if (item.type === 'booking' && item.data?.id) {
                      (navigation as any).navigate('BookingDetailScreen', { bookingId: item.data.id });
                    } else if (item.type === 'chat' && item.data?.id) {
                      const other = item.data.caregiver || item.data.care_recipient || {};
                      (navigation as any).navigate('ChatDetailsScreen', {
                        chatSessionId: item.data.id,
                        otherPartyName: other.full_name || 'User',
                        otherPartyAvatar: other.profile_photo_url,
                      });
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Icon
                    name={item.type === 'booking' ? 'calendar-check' : 'message-text'}
                    size={20}
                    color={item.type === 'booking' ? GREEN : colors.primary}
                    style={styles.recentActivityIcon}
                  />
                  <Text style={styles.recentActivityLabel} numberOfLines={2}>{item.label}</Text>
                  <Text style={styles.recentActivityDate}>
                    {item.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.recentActivityCard}>
              <Text style={styles.recentActivityEmpty}>{t('dashboard.noRecentActivity')}</Text>
            </View>
          )}
        </View>

        {/* RATE YOUR CAREGIVER PROMPT */}
        {unratedBooking && (
          <TouchableOpacity
            style={styles.rateCard}
            onPress={() => (navigation as any).navigate('BookingDetailScreen', { bookingId: unratedBooking.id })}
            activeOpacity={0.8}
          >
            <View style={styles.rateCardLeft}>
              <Icon name="star" size={28} color="#FFD700" />
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.rateCardTitle}>Rate your caregiver</Text>
                <Text style={styles.rateCardDesc}>
                  How was your visit with {unratedBooking.caregiver?.full_name || 'your caregiver'}?
                </Text>
              </View>
            </View>
            <Text style={styles.rateCardBtn}>Rate now</Text>
          </TouchableOpacity>
        )}

        {/* STATUS SECTION HEADER */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Current Status</Text>
          <TouchableOpacity
            onPress={() => (navigation as any).navigate('BookingsScreen')}
            accessibilityLabel="View all bookings"
            accessibilityRole="button"
          >
            <Text style={styles.link}>View All</Text>
          </TouchableOpacity>
        </View>

        {/* CURRENT STATUS SUMMARY */}
        {!loadingBookings && (
          <View style={styles.statusSummaryWrap}>
            <Text style={styles.statusSummaryText}>
              {currentBookings.length === 0
                ? 'No active bookings'
                : currentBookings.some((b: any) => b.status === 'in_progress')
                  ? `${currentBookings.filter((b: any) => b.status === 'in_progress').length} visit in progress · ${currentBookings.length} total active`
                  : `${currentBookings.length} upcoming visit${currentBookings.length !== 1 ? 's' : ''}`}
            </Text>
          </View>
        )}

        {/* CURRENT BOOKINGS */}
        {loadingBookings ? (
          <View style={styles.visitCard}>
            <Text style={styles.caregiverText}>Loading...</Text>
          </View>
        ) : currentBookings.length > 0 ? (
          currentBookings.map((booking: any) => {
            const caregiver = booking.caregiver || {};
            const serviceType = getServiceTypeLabel(booking.service_type);
            const scheduledDate = booking.scheduled_date ? new Date(booking.scheduled_date) : new Date();
            const timeStr = scheduledDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            const dateStr = scheduledDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const statusDisplay = getBookingStatusDisplay(booking.status || 'pending');

            return (
              <View key={booking.id} style={styles.visitCard}>
                <View style={styles.mapBox}>
                  <Icon name="map-marker" size={30} color={GREEN} />
                </View>

                <View style={{ flex: 1 }}>
                  <View style={styles.visitTitleRow}>
                    <Text style={styles.visitTitle}>{serviceType}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusDisplay.color + '20' }]}>
                      <Text style={[styles.statusBadgeText, { color: statusDisplay.color }]}>{statusDisplay.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.arriving}>● {dateStr} at {timeStr}</Text>

                  <View style={styles.caregiverRow}>
                    {caregiver.profile_photo_url ? (
                      <Image
                        source={{
                          uri: caregiver.profile_photo_url
                        }}
                        style={styles.smallAvatar}
                      />
                    ) : (
                      <View style={styles.smallAvatarPlaceholder}>
                        <Icon name="account" size={16} color="#6B7280" />
                      </View>
                    )}
                    <Text style={styles.caregiverText}>
                      {caregiver.full_name || 'Caregiver'} • {serviceType}
                    </Text>
                  </View>

                  <View style={styles.actionRow}>
                    {booking.status === 'in_progress' && (
                      <TouchableOpacity
                        style={styles.completeBtn}
                        onPress={() => handleMarkCompleted(booking.id)}
                        accessibilityLabel="Mark booking as completed"
                        accessibilityRole="button"
                      >
                        <Icon name="check-circle" size={16} color="#fff" style={{ marginRight: 6 }} />
                        <Text style={styles.completeBtnText}>Mark as Completed</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.trackBtn}
                      onPress={() => {
                        // Get recipient location from user's address or booking location
                        // For now, use default location (can be enhanced to use actual address geocoding)
                        const recipientLocation = user?.address?.latitude && user?.address?.longitude
                          ? { latitude: user.address.latitude, longitude: user.address.longitude }
                          : booking.location?.latitude && booking.location?.longitude
                            ? { latitude: booking.location.latitude, longitude: booking.location.longitude }
                            : { latitude: 17.3850, longitude: 78.4867 }; // Default: Hyderabad

                        (navigation as any).navigate('CaregiverMapScreen', {
                          recipientLocation,
                          recipientName: user?.full_name || 'Care Recipient',
                          caregiverName: caregiver.full_name || 'Caregiver',
                        });
                      }}
                      accessibilityLabel="Track caregiver"
                      accessibilityRole="button"
                    >
                      <Text style={styles.trackText}>📍 Track</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.visitCard}>
            <View style={styles.mapBox}>
              <Icon name="calendar-blank" size={30} color={GREEN} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.visitTitle}>No Active Bookings</Text>
              <Text style={styles.arriving}>● Create a new request to get started</Text>
            </View>
          </View>
        )}

        </ScrollView>
      </View>

      {/* BOTTOM NAV */}
      <BottomNav />

    </SafeAreaView>
  );
};

export default CareRecipientDashboard;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  contentWrap: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 120, paddingHorizontal: layout.screenPadding },

  // --- SWIPE BUTTON STYLES ---
  swipeContainer: {
    height: SWIPE_HEIGHT,
    backgroundColor: colors.error,
    borderRadius: SWIPE_HEIGHT / 2,
    marginBottom: layout.sectionGap,
    justifyContent: 'center',
    padding: 4,
    shadowColor: colors.error,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  swipeTextContainer: { position: 'absolute', width: '100%', alignItems: 'center', justifyContent: 'center', zIndex: 0 },
  swipeText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5, marginLeft: 30 },
  swipeKnob: {
    width: 50, height: 48, borderRadius: 24, backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center', zIndex: 1,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 3,
  },

  // --- MODAL STYLES ---
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalOverlayTouchable: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  keyboardView: { width: '100%', alignItems: 'center', padding: 20 },
  modalContent: {
    width: '90%', backgroundColor: '#fff', borderRadius: 24, padding: 24,
    shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 10,
  },
  closeBtn: { position: 'absolute', right: 20, top: 20, zIndex: 1, minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 12 },
  modalHeader: { alignItems: 'center', marginBottom: 16 },
  modalIconBg: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  modalDesc: { textAlign: 'center', color: '#6B7280', marginBottom: 24, fontSize: 16, lineHeight: 22 },
  inputContainer: { marginBottom: 16 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: '#111827' },
  phoneInputRow: { flexDirection: 'row', alignItems: 'center' },
  countryCode: { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB', borderTopLeftRadius: 12, borderBottomLeftRadius: 12, paddingVertical: 13, paddingHorizontal: 12, justifyContent: 'center' },
  countryText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  phoneInput: { flex: 1, backgroundColor: '#F9FAFB', borderWidth: 1, borderLeftWidth: 0, borderColor: '#E5E7EB', borderTopRightRadius: 12, borderBottomRightRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: '#111827' },
  confirmBtn: { backgroundColor: GREEN, paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 8, shadowColor: GREEN, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 4 },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  // --- HEADER ---
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: layout.sectionGap,
    paddingTop: spacing.sm,
  },
  menuButton: { minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, marginHorizontal: spacing.md },
  dateLabel: { color: colors.textSecondary, fontSize: typography.bodySmall, fontWeight: typography.weightSemiBold, letterSpacing: 0.5 },
  greeting: { fontSize: typography.headingLarge, fontWeight: typography.weightBold, color: colors.textPrimary, marginTop: 2 },
  bell: {
    backgroundColor: colors.card,
    padding: 12,
    borderRadius: borderRadius.md,
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.card,
  },
  notificationDot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.error, borderWidth: 1.5, borderColor: colors.card },
  weatherWrap: { marginBottom: layout.cardGap },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 60, paddingRight: 16 },
  menuPanel: { backgroundColor: '#fff', borderRadius: 16, minWidth: 260, maxWidth: '100%', marginHorizontal: 16, paddingVertical: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  menuHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  menuTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 12 },
  menuItemText: { fontSize: 16, color: '#1F2937', fontWeight: '500' },
  menuItemLogout: { borderTopWidth: 1, borderTopColor: '#E5E7EB', marginTop: 4 },
  menuItemTextLogout: { fontSize: 16, color: colors.error, fontWeight: '600' },

  quickActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: layout.cardGap,
    marginBottom: layout.sectionGap,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    minHeight: 100,
    ...shadows.card,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  quickActionLabel: {
    fontSize: typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: typography.weightSemiBold,
    textAlign: 'center',
  },
  profileCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: layout.sectionGap,
    ...shadows.card,
  },
  profileLeft: { flexDirection: "row", alignItems: "center" },
  avatarWrapper: { marginRight: 12 },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  percentBadge: { position: "absolute", bottom: -4, right: -4, backgroundColor: GREEN, borderRadius: 12, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1.5, borderColor: '#fff' },
  percentText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  name: { fontSize: 16, fontWeight: "700", color: '#1A1A1A' },
  link: { color: GREEN, fontSize: 14, fontWeight: "600" },

  requestBtn: {
    backgroundColor: colors.secondary,
    paddingVertical: 18,
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    alignItems: "center",
    justifyContent: 'center',
    marginBottom: layout.cardGap,
    minHeight: 56,
    ...shadows.button,
  },
  requestText: { fontSize: typography.body, fontWeight: typography.weightBold, color: colors.card },

  servicesRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24, paddingHorizontal: 16 },
  serviceItem: { alignItems: "center", width: "23%" },
  serviceIcon: {
    backgroundColor: "#fff", width: 60, height: 60, borderRadius: 20,
    alignItems: "center", justifyContent: "center", marginBottom: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  serviceText: { fontSize: 12, fontWeight: '500', color: '#1A1A1A' },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: 'center', marginBottom: layout.cardGap },
  sectionTitle: { fontSize: typography.headingSmall, fontWeight: typography.weightBold, color: colors.textPrimary },
  activeCaregiverBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondaryLight,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: layout.cardGap,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  activeCaregiverTextWrap: { marginLeft: 12, flex: 1 },
  activeCaregiverLabel: { fontSize: 12, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  activeCaregiverName: { fontSize: 16, fontWeight: '600', color: '#059669' },
  recentActivitySection: { marginBottom: layout.sectionGap },
  recentActivityCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.card,
  },
  recentActivityItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  recentActivityBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  recentActivityIcon: { marginRight: 12 },
  recentActivityLabel: { flex: 1, fontSize: 14, color: '#1A1A1A', fontWeight: '500' },
  recentActivityDate: { fontSize: 12, color: '#6B7280' },
  recentActivityEmpty: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', paddingVertical: 16 },
  statusSummaryWrap: { marginBottom: layout.cardGap },
  statusSummaryText: { fontSize: 14, color: '#6B7280', fontWeight: '500' },

  rateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.accentLight,
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: layout.sectionGap,
  },
  rateCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  rateCardTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  rateCardDesc: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  rateCardBtn: { fontSize: 15, fontWeight: '700', color: GREEN, marginLeft: 8 },

  visitCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    flexDirection: "row",
    marginBottom: layout.sectionGap,
    ...shadows.card,
  },
  mapBox: { width: 90, height: 90, borderRadius: 16, backgroundColor: "#DDEFE3", marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  visitTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 2 },
  visitTitle: { fontWeight: "700", fontSize: 16, color: '#1A1A1A' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText: { fontSize: 12, fontWeight: '600' },
  arriving: { color: GREEN, marginTop: 2, marginBottom: 8, fontWeight: "600", fontSize: 14 },
  caregiverRow: { flexDirection: "row", alignItems: "center" },
  smallAvatar: { width: 24, height: 24, borderRadius: 12, marginRight: 8 },
  smallAvatarPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  caregiverText: { color: "#555", fontSize: 14 },
  actionRow: { flexDirection: "row", marginTop: 12, alignItems: "center", gap: 8 },
  completeBtn: {
    backgroundColor: GREEN,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    minHeight: 48,
  },
  completeBtnText: { fontWeight: "700", color: "#fff", fontSize: 15 },
  trackBtn: {
    backgroundColor: "#E9F9EE",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  trackText: { fontWeight: "700", color: GREEN, fontSize: 15 },
  callBtn: { backgroundColor: "#F5F5F5", padding: 12, borderRadius: 12, minHeight: 48, justifyContent: 'center' },
  activityCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 14,
    marginBottom: 12, marginHorizontal: 16,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderColor: '#f0f0f0',
  },
  activityLeft: { flexDirection: "row", alignItems: "center" },
  activityIconBlue: { backgroundColor: "#E7F0FF", padding: 10, borderRadius: 12, marginRight: 12 },
  activityIconPurple: { backgroundColor: "#F0E7FF", padding: 10, borderRadius: 12, marginRight: 12 },
  activityTitle: { fontWeight: "600", color: '#1A1A1A', fontSize: 15 },
  activitySub: { fontSize: 12, color: "#777", marginTop: 2 },
  completed: { color: "#999", fontWeight: "600", fontSize: 13 },
  rebook: { color: GREEN, fontWeight: "600", fontSize: 13 },
});