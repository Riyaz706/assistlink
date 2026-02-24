import React, { useState, useRef, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Dimensions, StatusBar, Modal, Platform, Animated, Easing, Alert, ActivityIndicator, Switch, Image } from 'react-native';
import Slider from '@react-native-community/slider';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { api } from './api/client';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useErrorHandler, ErrorDetails } from './hooks/useErrorHandler';
import BottomNav from './BottomNav';
import LeafletMap from './components/LeafletMap';
import { colors, typography, spacing, layout, borderRadius } from './theme';

// Conditional imports for native modules (not available on web)
let Location: any = null;

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

// Import expo-location (works on native platforms)
if (Platform.OS !== 'web') {
  try {
    Location = require('expo-location');
  } catch (e) {
    console.warn('expo-location not available:', e);
  }
}

// Maps use Leaflet (LeafletMap component)

// Location fallback
if (!Location) {
  Location = {
    hasServicesEnabledAsync: async () => false,
    requestForegroundPermissionsAsync: async () => ({ status: 'denied' }),
    getCurrentPositionAsync: async () => ({ coords: { latitude: 0, longitude: 0 } }),
    Accuracy: { Balanced: 0 }
  };
}

const { width } = Dimensions.get('window');

// Calculate tab width based on screen width and padding
const TAB_BAR_PADDING = 4;
const CONTAINER_PADDING = 20;
const TAB_WIDTH = (width - (CONTAINER_PADDING * 2) - (TAB_BAR_PADDING * 2)) / 3;

const COLORS = {
  background: colors.background,
  primaryGreen: colors.secondary,
  primaryGreenLight: colors.secondaryLight,
  urgentRed: colors.error,
  urgentRedLight: '#FEE2E2',
  darkText: colors.textPrimary,
  grayText: colors.textSecondary,
  white: colors.card,
  border: colors.border,
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

type TabType = 'exam' | 'daily' | 'urgent';

const DRAFT_KEY = 'assistlink_care_request_draft';

const NewRequestScreen = ({ navigation }: any) => {
  const { error, handleError, clearError } = useErrorHandler();
  const [activeTab, setActiveTab] = useState<TabType>('exam');

  // Animation Value: 0 = Exam, 1 = Daily, 2 = Urgent
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let toValue = 0;
    if (activeTab === 'daily') toValue = 1;
    if (activeTab === 'urgent') toValue = 2;

    Animated.timing(slideAnim, {
      toValue,
      duration: 300,
      useNativeDriver: false,
      easing: Easing.out(Easing.ease),
    }).start();
  }, [activeTab]);

  // Interpolations
  const translateX = slideAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, TAB_WIDTH, TAB_WIDTH * 2],
  });

  const backgroundColor = slideAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [colors.primary, colors.secondary, colors.error],
  });

  const [selectedAssistance, setSelectedAssistance] = useState<string>('scribe');
  const [selectedUrgency, setSelectedUrgency] = useState<string | null>(null);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [examSubject, setExamSubject] = useState('');
  const [examVenue, setExamVenue] = useState('');
  const [accommodationsNeeded, setAccommodationsNeeded] = useState('');

  const [isPickerVisible, setPickerVisible] = useState(false);
  const [pickerStep, setPickerStep] = useState<'date' | 'startTime' | 'endTime'>('date');
  const [currentPickingMode, setCurrentPickingMode] = useState<'exam' | 'daily'>('exam');
  const [pickingTimeType, setPickingTimeType] = useState<'startTime' | 'endTime'>('startTime');

  // Exam date & time states
  const [examDate, setExamDate] = useState<string>('');
  const [examStartTime, setExamStartTime] = useState<string>('');
  const [examEndTime, setExamEndTime] = useState<string>('');
  const [examDuration, setExamDuration] = useState<string>('');
  const [examDurationHours, setExamDurationHours] = useState(2);

  // Daily date & time states
  const [dailyDate, setDailyDate] = useState<string>('');
  const [dailyStartTime, setDailyStartTime] = useState<string>('');
  const [dailyEndTime, setDailyEndTime] = useState<string>('');
  const [dailyDuration, setDailyDuration] = useState<string>('');
  const [dailyDurationHours, setDailyDurationHours] = useState(2);
  const [tempDate, setTempDate] = useState('');
  const [viewDate, setViewDate] = useState(new Date());

  // Recurring settings - PRD: Recurring Settings
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<'weekly' | 'daily' | 'monthly'>('weekly');
  const [recurringDaysOfWeek, setRecurringDaysOfWeek] = useState<number[]>([1]); // 0=Sun..6=Sat, default Mon
  const [recurringEndDate, setRecurringEndDate] = useState<string>('');

  // Preferred caregiver - PRD: Care Request Screen
  const [preferredCaregiver, setPreferredCaregiver] = useState<{ id: string; full_name?: string; profile_photo_url?: string } | null>(null);
  const [preferredCaregiverModalVisible, setPreferredCaregiverModalVisible] = useState(false);
  const [pastCaregivers, setPastCaregivers] = useState<{ id: string; full_name?: string; profile_photo_url?: string }[]>([]);
  const [loadingPastCaregivers, setLoadingPastCaregivers] = useState(false);

  // Draft save: load on mount
  useEffect(() => {
    AsyncStorage.getItem(DRAFT_KEY).then((json) => {
      if (json) {
        try {
          const d = JSON.parse(json);
          if (d.activeTab) setActiveTab(d.activeTab);
          if (d.examSubject) setExamSubject(d.examSubject);
          if (d.examVenue) setExamVenue(d.examVenue);
          if (d.accommodationsNeeded) setAccommodationsNeeded(d.accommodationsNeeded);
          if (d.examDate) setExamDate(d.examDate);
          if (d.examStartTime) setExamStartTime(d.examStartTime);
          if (d.examEndTime) setExamEndTime(d.examEndTime);
          if (d.additionalNotes) setAdditionalNotes(d.additionalNotes);
          if (d.isRecurring != null) setIsRecurring(d.isRecurring);
          if (d.recurringFrequency) setRecurringFrequency(d.recurringFrequency);
          if (d.recurringDaysOfWeek?.length) setRecurringDaysOfWeek(d.recurringDaysOfWeek);
          if (d.recurringEndDate) setRecurringEndDate(d.recurringEndDate);
          if (d.preferredCaregiver) setPreferredCaregiver(d.preferredCaregiver);
        } catch (_) {}
      }
    });
  }, []);

  const saveDraft = () => {
    const draft = {
      activeTab,
      examSubject,
      examVenue,
      accommodationsNeeded,
      examDate,
      examStartTime,
      examEndTime,
      additionalNotes,
      isRecurring,
      recurringFrequency,
      recurringDaysOfWeek,
      recurringEndDate,
      preferredCaregiver,
    };
    AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  };

  const clearDraft = () => {
    AsyncStorage.removeItem(DRAFT_KEY);
  };

  const openPicker = (mode: 'exam' | 'daily', step: 'date' | 'startTime' | 'endTime' = 'date') => {
    setCurrentPickingMode(mode);
    setPickerStep(step);
    if (step === 'startTime' || step === 'endTime') {
      setPickingTimeType(step);
    }
    setViewDate(new Date());
    setPickerVisible(true);
  };

  const changeMonth = (increment: number) => {
    const newDate = new Date(viewDate);
    newDate.setMonth(newDate.getMonth() + increment);
    setViewDate(newDate);
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const handleDateSelect = (day: number) => {
    const year = viewDate.getFullYear();
    const month = MONTH_NAMES[viewDate.getMonth()].substring(0, 3);
    const dateStr = `${month} ${day}, ${year}`;
    setTempDate(dateStr);

    if (currentPickingMode === 'exam') {
      setExamDate(dateStr);
      setPickerStep('startTime');
      setPickingTimeType('startTime');
    } else {
      setDailyDate(dateStr);
      setPickerStep('startTime');
      setPickingTimeType('startTime');
    }
  };

  const handleTimeSelect = (time: string) => {
    if (currentPickingMode === 'exam') {
      if (pickerStep === 'startTime') {
        setExamStartTime(time);
        setPickerStep('endTime');
        setPickingTimeType('endTime');
      } else if (pickerStep === 'endTime') {
        setExamEndTime(time);
        // Calculate duration using the start time
        if (examStartTime) {
          calculateDuration(examStartTime, time, 'exam');
        }
        setPickerVisible(false);
      }
    } else {
      // Daily mode
      if (pickerStep === 'startTime') {
        setDailyStartTime(time);
        setPickerStep('endTime');
        setPickingTimeType('endTime');
      } else if (pickerStep === 'endTime') {
        setDailyEndTime(time);
        // Calculate duration using the start time
        if (dailyStartTime) {
          calculateDuration(dailyStartTime, time, 'daily');
        }
        setPickerVisible(false);
      }
    }
  };

  const calculateDuration = (startTime: string, endTime: string, mode: 'exam' | 'daily' = 'exam') => {
    if (!startTime || !endTime) return;

    // Parse time strings (e.g., "08:00 AM" or "02:00 PM")
    const parseTime = (timeStr: string): number => {
      const [time, period] = timeStr.split(' ');
      const [hours, minutes] = time.split(':').map(Number);
      let totalMinutes = hours * 60 + minutes;
      if (period === 'PM' && hours !== 12) totalMinutes += 12 * 60;
      if (period === 'AM' && hours === 12) totalMinutes -= 12 * 60;
      return totalMinutes;
    };

    const startMinutes = parseTime(startTime);
    const endMinutes = parseTime(endTime);

    let durationMinutes: number;
    if (endMinutes < startMinutes) {
      // End time is next day
      durationMinutes = (24 * 60 - startMinutes) + endMinutes;
    } else {
      durationMinutes = endMinutes - startMinutes;
    }

    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    const durationText = minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;

    if (mode === 'exam') {
      setExamDuration(durationText);
    } else {
      setDailyDuration(durationText);
    }
  };

  const goToMatchmaking = () => {
    clearError();

    // VALIDATION
    try {
      if (activeTab === 'exam') {
        if (!examDate) throw new Error("Please select an exam date.");
        if (!examStartTime) throw new Error("Please select a start time.");
        if (!examEndTime) throw new Error("Please select an end time.");
        if (!locationText && !selectedLocation) throw new Error("Please select a location.");
      } else if (activeTab === 'daily') {
        if (!dailyDate) throw new Error("Please select a date.");
        if (!dailyStartTime) throw new Error("Please select a start time.");
        if (!dailyEndTime) throw new Error("Please select an end time.");
        if (!locationText && !selectedLocation) throw new Error("Please select a location.");
      } else if (activeTab === 'urgent') {
        if (!selectedUrgency) throw new Error("Please select the nature of the emergency.");
        if (!selectedLocation) throw new Error("Location makes finding caregivers easier. Please enable location or select one.");
      }
    } catch (err: any) {
      handleError(err, 'validation');
      return;
    }

    // Build examDateTime / dailyDateTime for Matchmaking (format: "Oct 15, 2025, 10:00 AM")
    const examDateTime = (activeTab === 'exam' && examDate && examStartTime) ? `${examDate}, ${examStartTime}` : undefined;
    const dailyDateTime = (activeTab === 'daily' && dailyDate && dailyStartTime) ? `${dailyDate}, ${dailyStartTime}` : undefined;

    // Build a simple payload to help filter caregivers and pre-fill booking
    const payload: any = {
      serviceType: activeTab === 'exam' ? 'exam_assistance' : activeTab === 'daily' ? 'daily_care' : 'urgent_care',
      assistanceType: activeTab === 'exam' ? selectedAssistance : null,
      examSubject: examSubject,
      examVenue: examVenue,
      accommodationsNeeded: accommodationsNeeded,
      examDate: examDate,
      examStartTime: examStartTime,
      examEndTime: examEndTime,
      examDateTime,
      examDuration: examDuration,
      examDurationHours: examDurationHours,
      dailyDate: dailyDate,
      dailyStartTime: dailyStartTime,
      dailyEndTime: dailyEndTime,
      dailyDateTime,
      dailyDuration: dailyDuration,
      dailyDurationHours: dailyDurationHours,
      locationText,
      location: selectedLocation, // Include coordinates
      urgencyLevel: activeTab === 'urgent' ? 'high' : 'medium',
      specificRequirements: activeTab === 'urgent' ? selectedUrgency : additionalNotes, // Map urgency type or notes
      additionalNotes: additionalNotes, // Pass raw notes too
      isRecurring: (activeTab === 'exam' || activeTab === 'daily') ? isRecurring : false,
      recurring_pattern: (activeTab === 'exam' || activeTab === 'daily') && isRecurring
        ? { frequency: recurringFrequency, days_of_week: recurringFrequency === 'weekly' ? recurringDaysOfWeek : undefined, end_date: recurringEndDate || null }
        : undefined,
      preferredCaregiverId: preferredCaregiver?.id || undefined,
    };
    clearDraft();
    navigation.navigate('MatchmakingScreen', payload);
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(viewDate);
    const firstDayOffset = getFirstDayOfMonth(viewDate);
    const startingBlanks = Array.from({ length: firstDayOffset });
    const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const totalSlots = startingBlanks.length + daysArray.length;
    const remainder = totalSlots % 7;
    const fillersNeeded = remainder === 0 ? 0 : 7 - remainder;
    const trailingFillers = Array.from({ length: fillersNeeded });

    return (
      <View style={styles.calendarGrid}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <Text key={d} style={styles.calendarDayLabel}>{d}</Text>
        ))}
        {startingBlanks.map((_, i) => (
          <View key={`start-${i}`} style={[styles.calendarCell, { backgroundColor: 'transparent' }]} />
        ))}
        {daysArray.map((day) => (
          <TouchableOpacity
            key={day}
            style={styles.calendarCell}
            onPress={() => handleDateSelect(day)}
          >
            <Text style={styles.calendarDateText}>{day}</Text>
          </TouchableOpacity>
        ))}
        {trailingFillers.map((_, i) => (
          <View key={`end-${i}`} style={[styles.calendarCell, { backgroundColor: 'transparent' }]} />
        ))}
      </View>
    );
  };

  const renderDateTimePicker = () => (
    <Modal visible={isPickerVisible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            {pickerStep === 'date' ? (
              <View style={styles.dateHeaderContainer}>
                <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.navArrow}>
                  <Icon name="chevron-left" size={28} color={COLORS.darkText} />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>
                  {MONTH_NAMES[viewDate.getMonth()]} {viewDate.getFullYear()}
                </Text>
                <TouchableOpacity onPress={() => changeMonth(1)} style={styles.navArrow}>
                  <Icon name="chevron-right" size={28} color={COLORS.darkText} />
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.modalTitle}>
                {pickerStep === 'startTime' ? 'Select Start Time' : 'Select End Time'}
              </Text>
            )}
            <TouchableOpacity onPress={() => setPickerVisible(false)} style={styles.closeButton}>
              <Icon name="close" size={24} color={COLORS.darkText} />
            </TouchableOpacity>
          </View>
          {pickerStep === 'date' ? renderCalendar() : (
            <ScrollView style={{ maxHeight: 300 }}>
              {['08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM', '06:00 PM', '07:00 PM', '08:00 PM', '09:00 PM', '10:00 PM'].map((time) => {
                // Disable end times that are before or equal to start time (if selecting end time)
                let isDisabled = false;
                if (pickerStep === 'endTime') {
                  const parseTime = (timeStr: string): number => {
                    const [t, period] = timeStr.split(' ');
                    const [h, m] = t.split(':').map(Number);
                    let total = h * 60 + m;
                    if (period === 'PM' && h !== 12) total += 12 * 60;
                    if (period === 'AM' && h === 12) total -= 12 * 60;
                    return total;
                  };

                  const startTime = currentPickingMode === 'exam' ? examStartTime : dailyStartTime;
                  if (startTime) {
                    const startMinutes = parseTime(startTime);
                    const timeMinutes = parseTime(time);
                    isDisabled = timeMinutes <= startMinutes;
                  }
                }

                return (
                  <TouchableOpacity
                    key={time}
                    style={[styles.timeOption, isDisabled && styles.timeOptionDisabled]}
                    onPress={() => !isDisabled && handleTimeSelect(time)}
                    disabled={isDisabled}
                  >
                    <Text style={[styles.timeText, isDisabled && styles.timeTextDisabled]}>{time}</Text>
                    <Icon name="clock-outline" size={20} color={isDisabled ? COLORS.border : COLORS.grayText} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );

  const renderTabs = () => (
    <View style={styles.tabContainer}>
      <Text style={styles.sectionTitle}>Service Type</Text>

      {/* Tab Bar Container */}
      <View style={styles.tabBar}>
        {/* Animated Sliding Indicator */}
        <Animated.View
          style={[
            styles.animatedIndicator,
            {
              transform: [{ translateX }],
              backgroundColor: backgroundColor
            }
          ]}
        />

        {['exam', 'daily', 'urgent'].map((tab) => {
          const isActive = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={styles.tabButton}
              onPress={() => setActiveTab(tab as TabType)}
              activeOpacity={0.8}
            >
              <Icon
                name={tab === 'exam' ? 'book-open-page-variant' : tab === 'daily' ? 'hand-heart' : 'alarm-light'}
                size={20}
                // Color changes based on active state
                color={isActive ? COLORS.white : COLORS.grayText}
              />
              <Text style={[
                styles.tabText,
                isActive && styles.activeTabText
              ]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const [locationText, setLocationText] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapRegion, setMapRegion] = useState({
    latitude: 17.3850, // Default: Hyderabad coordinates
    longitude: 78.4867,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });
  const [locationLoading, setLocationLoading] = useState(false);

  // Get current location
  const getCurrentLocation = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not Available', 'Location services are only available on mobile devices.');
      return;
    }

    setLocationLoading(true);
    try {
      // Check if location services are enabled
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        Alert.alert(
          'Location Services Disabled',
          'Please enable location services in your device settings.',
          [{ text: 'OK' }]
        );
        setLocationLoading(false);
        return;
      }

      // Request foreground location permission
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Location permission is required to get your current location.',
          [{ text: 'OK' }]
        );
        setLocationLoading(false);
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const newLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setSelectedLocation(newLocation);
      setMapRegion({
        ...mapRegion,
        latitude: newLocation.latitude,
        longitude: newLocation.longitude,
      });

      // Reverse geocode to get address
      try {
        const addresses = await Location.reverseGeocodeAsync(newLocation);
        if (addresses && addresses.length > 0) {
          const addr = addresses[0];
          const addressParts = [
            addr.street,
            addr.streetNumber,
            addr.district,
            addr.city,
            addr.region,
            addr.postalCode,
          ].filter(Boolean);
          setLocationText(addressParts.join(', ') || 'Current Location');
        }
      } catch (e) {
        console.warn('Reverse geocoding failed:', e);
        setLocationText('Current Location');
      }

      // Map center updates via mapRegion state (LeafletMap is controlled)
    } catch (error: any) {
      handleError(error, 'location-error');
    } finally {
      setLocationLoading(false);
    }
  };

  // Handle map press to select location (Leaflet sends lat, lng)
  // Load past caregivers (from bookings + chat sessions) for preferred caregiver picker
  const loadPastCaregivers = async () => {
    setLoadingPastCaregivers(true);
    try {
      const [bookingsRes, chatRes] = await Promise.all([
        api.getDashboardBookings({ limit: 50 }).catch(() => []),
        api.getChatSessions().catch(() => []),
      ]);
      const bookings = (bookingsRes as any[]) || [];
      const chatSessions = (chatRes as any[]) || [];

      const seen = new Set<string>();
      const list: { id: string; full_name?: string; profile_photo_url?: string }[] = [];

      // From bookings: caregiver_id / caregiver
      for (const b of bookings) {
        const cid = b.caregiver_id || b.caregiver?.id;
        if (cid && !seen.has(cid)) {
          seen.add(cid);
          list.push({
            id: cid,
            full_name: b.caregiver?.full_name || 'Caregiver',
            profile_photo_url: b.caregiver?.profile_photo_url,
          });
        }
      }

      // From chat sessions (care_recipient sees caregiver as other party)
      for (const s of chatSessions) {
        const c = s.caregiver || s.caregiver_id;
        const cid = typeof c === 'object' ? c?.id : c;
        if (cid && !seen.has(cid)) {
          seen.add(cid);
          const caregiver = typeof c === 'object' ? c : null;
          list.push({
            id: cid,
            full_name: caregiver?.full_name || 'Caregiver',
            profile_photo_url: caregiver?.profile_photo_url,
          });
        }
      }

      setPastCaregivers(list);
    } catch (e) {
      setPastCaregivers([]);
    } finally {
      setLoadingPastCaregivers(false);
    }
  };

  const openPreferredCaregiverModal = () => {
    setPreferredCaregiverModalVisible(true);
    loadPastCaregivers();
  };

  const handleMapPress = (lat: number, lng: number) => {
    const newLocation = { latitude: lat, longitude: lng };
    setSelectedLocation(newLocation);
    setMapRegion((prev) => ({ ...prev, latitude: lat, longitude: lng }));

    // Reverse geocode to get address
    if (Location && Location.reverseGeocodeAsync) {
      (async () => {
        try {
          const addresses = await Location.reverseGeocodeAsync(newLocation);
          if (addresses && addresses.length > 0) {
            const addr = addresses[0];
            const addressParts = [
              addr.street,
              addr.streetNumber,
              addr.district,
              addr.city,
              addr.region,
              addr.postalCode,
            ].filter(Boolean);
            setLocationText(addressParts.join(', ') || 'Selected Location');
          }
        } catch (e) {
          console.warn('Reverse geocoding failed:', e);
          setLocationText('Selected Location');
        }
      })();
    }
  };

  const renderPreferredCaregiverSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>Preferred caregiver (optional)</Text>
      <TouchableOpacity
        style={styles.inputContainer}
        onPress={openPreferredCaregiverModal}
      >
        {preferredCaregiver ? (
          <View style={styles.preferredCaregiverRow}>
            {preferredCaregiver.profile_photo_url ? (
              <Image source={{ uri: preferredCaregiver.profile_photo_url }} style={styles.preferredCaregiverAvatar} />
            ) : (
              <View style={[styles.preferredCaregiverAvatar, styles.preferredCaregiverAvatarPlaceholder]}>
                <Icon name="account" size={20} color={COLORS.grayText} />
              </View>
            )}
            <Text style={styles.inputText}>{preferredCaregiver.full_name || 'Caregiver'}</Text>
            <TouchableOpacity onPress={() => setPreferredCaregiver(null)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Icon name="close-circle" size={22} color={COLORS.grayText} />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={[styles.inputText, { color: COLORS.grayText }]}>Select caregiver or leave as any</Text>
            <Icon name="account-group" size={20} color={COLORS.primaryGreen} />
          </>
        )}
      </TouchableOpacity>
      <Modal visible={preferredCaregiverModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setPreferredCaregiverModalVisible(false)} />
          <View style={styles.preferredCaregiverModal}>
            <Text style={styles.modalTitle}>Preferred caregiver</Text>
            {loadingPastCaregivers ? (
              <ActivityIndicator size="small" color={COLORS.primaryGreen} style={{ marginVertical: 24 }} />
            ) : pastCaregivers.length === 0 ? (
              <Text style={styles.modalEmptyText}>No past caregivers yet. You'll see them after your first booking.</Text>
            ) : (
              <ScrollView style={styles.preferredCaregiverList}>
                <TouchableOpacity
                  style={styles.preferredCaregiverItem}
                  onPress={() => { setPreferredCaregiver(null); setPreferredCaregiverModalVisible(false); }}
                >
                  <Icon name="account-multiple" size={24} color={COLORS.grayText} />
                  <Text style={styles.preferredCaregiverItemText}>No preference (any caregiver)</Text>
                </TouchableOpacity>
                {pastCaregivers.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.preferredCaregiverItem}
                    onPress={() => { setPreferredCaregiver(c); setPreferredCaregiverModalVisible(false); }}
                  >
                    {c.profile_photo_url ? (
                      <Image source={{ uri: c.profile_photo_url }} style={styles.preferredCaregiverAvatar} />
                    ) : (
                      <View style={[styles.preferredCaregiverAvatar, styles.preferredCaregiverAvatarPlaceholder]}>
                        <Icon name="account" size={20} color={COLORS.grayText} />
                      </View>
                    )}
                    <Text style={styles.preferredCaregiverItemText}>{c.full_name || 'Caregiver'}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setPreferredCaregiverModalVisible(false)}>
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );

  const renderLocationSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>Location</Text>
      <View style={styles.locationInputContainer}>
        <Icon name="map-marker" size={20} color={COLORS.primaryGreen} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.locationInput}
          placeholder="Campus Center, Room 304"
          placeholderTextColor={COLORS.grayText}
          value={locationText}
          onChangeText={setLocationText}
        />
        <TouchableOpacity onPress={getCurrentLocation} disabled={locationLoading}>
          {locationLoading ? (
            <ActivityIndicator size="small" color={COLORS.primaryGreen} />
          ) : (
            <Icon name="crosshairs-gps" size={20} color={COLORS.primaryGreen} />
          )}
        </TouchableOpacity>
      </View>
      <Text style={styles.subLabel}>Map preview</Text>
      <View style={styles.mapContainer}>
        <LeafletMap
          center={{ lat: mapRegion.latitude, lng: mapRegion.longitude }}
          zoom={14}
          markers={selectedLocation ? [{ id: 'selected', lat: selectedLocation.latitude, lng: selectedLocation.longitude, label: locationText || 'Selected Location' }] : []}
          onMapPress={handleMapPress}
          style={styles.map}
        />
        <View style={styles.mapOverlay}>
          <Text style={styles.mapOverlayText}>Tap on map to select location</Text>
        </View>
      </View>
    </View>
  );

  const renderExamContent = () => (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Exam Details</Text>
        <Text style={styles.subLabel}>Subject / Course</Text>
        <View style={styles.inputContainer}>
          <TextInput style={styles.input} placeholder="e.g. Calculus II, History 101" placeholderTextColor={COLORS.grayText} value={examSubject} onChangeText={setExamSubject} />
          <Icon name="book-open-variant" size={20} color={COLORS.primaryGreen} />
        </View>
        <Text style={styles.subLabel}>Venue / Location</Text>
        <View style={styles.inputContainer}>
          <TextInput style={styles.input} placeholder="e.g. Hall A, Room 101" placeholderTextColor={COLORS.grayText} value={examVenue} onChangeText={setExamVenue} />
          <Icon name="map-marker" size={20} color={COLORS.primaryGreen} />
        </View>
        <Text style={styles.subLabel}>Accommodations needed</Text>
        <View style={styles.inputContainer}>
          <TextInput style={styles.input} placeholder="e.g. Wheelchair access, extra time" placeholderTextColor={COLORS.grayText} value={accommodationsNeeded} onChangeText={setAccommodationsNeeded} />
          <Icon name="accessibility" size={20} color={COLORS.primaryGreen} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.subLabel}>Assistance Required</Text>
        <View style={styles.gridContainer}>
          {['scribe', 'reader'].map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.gridButton, selectedAssistance === type && styles.gridButtonActive]}
              onPress={() => setSelectedAssistance(type)}
            >
              <Icon
                name={type === 'scribe' ? 'fountain-pen-tip' : 'account-voice'}
                size={24}
                color={selectedAssistance === type ? COLORS.darkText : COLORS.grayText}
              />
              <Text style={styles.gridButtonText}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Text>
              {selectedAssistance === type &&
                <Icon name="check-circle" size={16} color={COLORS.primaryGreen} style={styles.checkIcon} />
              }
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Schedule</Text>

        <Text style={styles.subLabel}>Exam Date</Text>
        <TouchableOpacity
          style={styles.inputContainer}
          onPress={() => openPicker('exam', 'date')}
        >
          <Text style={[styles.inputText, !examDate && { color: COLORS.grayText }]}>
            {examDate || 'Select Date'}
          </Text>
          <Icon name="calendar" size={20} color={COLORS.primaryGreen} />
        </TouchableOpacity>

        <View style={styles.timeRow}>
          <View style={styles.timeInputContainer}>
            <Text style={styles.subLabel}>Start Time</Text>
            <TouchableOpacity
              style={styles.inputContainer}
              onPress={() => openPicker('exam', 'startTime')}
              disabled={!examDate}
            >
              <Text style={[styles.inputText, !examStartTime && { color: COLORS.grayText }]}>
                {examStartTime || 'Select Start Time'}
              </Text>
              <Icon name="clock-outline" size={20} color={COLORS.primaryGreen} />
            </TouchableOpacity>
          </View>

          <View style={styles.timeInputContainer}>
            <Text style={styles.subLabel}>End Time</Text>
            <TouchableOpacity
              style={styles.inputContainer}
              onPress={() => openPicker('exam', 'endTime')}
              disabled={!examStartTime}
            >
              <Text style={[styles.inputText, !examEndTime && { color: COLORS.grayText }]}>
                {examEndTime || 'Select End Time'}
              </Text>
              <Icon name="clock-outline" size={20} color={COLORS.primaryGreen} />
            </TouchableOpacity>
          </View>
        </View>

        {examDuration && (
          <View style={styles.durationContainer}>
            <Icon name="timer-outline" size={20} color={COLORS.primaryGreen} />
            <Text style={styles.durationText}>From times: {examDuration}</Text>
          </View>
        )}
        <Text style={styles.subLabel}>Estimated duration (hours)</Text>
        <View style={styles.sliderRow}>
          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={8}
            step={0.5}
            value={examDurationHours}
            onValueChange={setExamDurationHours}
            minimumTrackTintColor={COLORS.primaryGreen}
            maximumTrackTintColor={COLORS.border}
            thumbTintColor={COLORS.primaryGreen}
          />
          <Text style={styles.sliderValue}>{examDurationHours}h</Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.recurringRow}>
          <Text style={styles.sectionLabel}>Recurring</Text>
          <Switch value={isRecurring} onValueChange={setIsRecurring} trackColor={{ false: COLORS.border, true: COLORS.primaryGreen }} thumbColor="#FFF" />
        </View>
        {isRecurring && (
          <>
            <Text style={styles.subLabel}>Frequency</Text>
            <View style={styles.frequencyRow}>
              {(['weekly', 'daily', 'monthly'] as const).map((f) => (
                <TouchableOpacity key={f} style={[styles.frequencyChip, recurringFrequency === f && styles.frequencyChipActive]} onPress={() => setRecurringFrequency(f)}>
                  <Text style={[styles.frequencyChipText, recurringFrequency === f && styles.frequencyChipTextActive]}>{f.charAt(0).toUpperCase() + f.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {recurringFrequency === 'weekly' && (
              <>
                <Text style={styles.subLabel}>Days of week</Text>
                <View style={styles.daysRow}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                    <TouchableOpacity key={d} style={[styles.dayChip, recurringDaysOfWeek.includes(i) && styles.dayChipActive]} onPress={() => setRecurringDaysOfWeek(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i].sort())}>
                      <Text style={[styles.dayChipText, recurringDaysOfWeek.includes(i) && styles.dayChipTextActive]}>{d.slice(0, 1)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
            <Text style={styles.subLabel}>End date (optional, YYYY-MM-DD)</Text>
            <View style={styles.inputContainer}>
              <TextInput style={styles.input} placeholder="e.g. 2025-12-31" placeholderTextColor={COLORS.grayText} value={recurringEndDate} onChangeText={setRecurringEndDate} />
              <Icon name="calendar" size={20} color={COLORS.primaryGreen} />
            </View>
          </>
        )}
      </View>

      {renderPreferredCaregiverSection()}
      {renderLocationSection()}

      <TouchableOpacity style={styles.draftButton} onPress={saveDraft}>
        <Icon name="content-save" size={20} color={COLORS.primaryGreen} />
        <Text style={styles.draftButtonText}>Save draft</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.mainButton} onPress={goToMatchmaking}>
        <Text style={styles.mainButtonText}>Find Caregiver</Text>
        <Icon name="magnify" size={24} color="white" style={{ marginLeft: 8 }} />
      </TouchableOpacity>
    </>
  );

  const renderDailyContent = () => (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Schedule</Text>

        <Text style={styles.subLabel}>Date</Text>
        <TouchableOpacity
          style={styles.inputContainer}
          onPress={() => openPicker('daily', 'date')}
        >
          <Text style={[styles.inputText, !dailyDate && { color: COLORS.grayText }]}>
            {dailyDate || 'Select Date'}
          </Text>
          <Icon name="calendar" size={20} color={COLORS.primaryGreen} />
        </TouchableOpacity>

        <View style={styles.timeRow}>
          <View style={styles.timeInputContainer}>
            <Text style={styles.subLabel}>Start Time</Text>
            <TouchableOpacity
              style={styles.inputContainer}
              onPress={() => openPicker('daily', 'startTime')}
              disabled={!dailyDate}
            >
              <Text style={[styles.inputText, !dailyStartTime && { color: COLORS.grayText }]}>
                {dailyStartTime || 'Select Start Time'}
              </Text>
              <Icon name="clock-outline" size={20} color={COLORS.primaryGreen} />
            </TouchableOpacity>
          </View>

          <View style={styles.timeInputContainer}>
            <Text style={styles.subLabel}>End Time</Text>
            <TouchableOpacity
              style={styles.inputContainer}
              onPress={() => openPicker('daily', 'endTime')}
              disabled={!dailyStartTime}
            >
              <Text style={[styles.inputText, !dailyEndTime && { color: COLORS.grayText }]}>
                {dailyEndTime || 'Select End Time'}
              </Text>
              <Icon name="clock-outline" size={20} color={COLORS.primaryGreen} />
            </TouchableOpacity>
          </View>
        </View>

        {dailyDuration && (
          <View style={styles.durationContainer}>
            <Icon name="timer-outline" size={20} color={COLORS.primaryGreen} />
            <Text style={styles.durationText}>From times: {dailyDuration}</Text>
          </View>
        )}
        <Text style={styles.subLabel}>Estimated duration (hours)</Text>
        <View style={styles.sliderRow}>
          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={12}
            step={0.5}
            value={dailyDurationHours}
            onValueChange={setDailyDurationHours}
            minimumTrackTintColor={COLORS.primaryGreen}
            maximumTrackTintColor={COLORS.border}
            thumbTintColor={COLORS.primaryGreen}
          />
          <Text style={styles.sliderValue}>{dailyDurationHours}h</Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.recurringRow}>
          <Text style={styles.sectionLabel}>Recurring</Text>
          <Switch value={isRecurring} onValueChange={setIsRecurring} trackColor={{ false: COLORS.border, true: COLORS.primaryGreen }} thumbColor="#FFF" />
        </View>
        {isRecurring && (
          <>
            <Text style={styles.subLabel}>Frequency</Text>
            <View style={styles.frequencyRow}>
              {(['weekly', 'daily', 'monthly'] as const).map((f) => (
                <TouchableOpacity key={f} style={[styles.frequencyChip, recurringFrequency === f && styles.frequencyChipActive]} onPress={() => setRecurringFrequency(f)}>
                  <Text style={[styles.frequencyChipText, recurringFrequency === f && styles.frequencyChipTextActive]}>{f.charAt(0).toUpperCase() + f.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {recurringFrequency === 'weekly' && (
              <>
                <Text style={styles.subLabel}>Days of week</Text>
                <View style={styles.daysRow}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                    <TouchableOpacity key={d} style={[styles.dayChip, recurringDaysOfWeek.includes(i) && styles.dayChipActive]} onPress={() => setRecurringDaysOfWeek(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i].sort())}>
                      <Text style={[styles.dayChipText, recurringDaysOfWeek.includes(i) && styles.dayChipTextActive]}>{d.slice(0, 1)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
            <Text style={styles.subLabel}>End date (optional, YYYY-MM-DD)</Text>
            <View style={styles.inputContainer}>
              <TextInput style={styles.input} placeholder="e.g. 2025-12-31" placeholderTextColor={COLORS.grayText} value={recurringEndDate} onChangeText={setRecurringEndDate} />
              <Icon name="calendar" size={20} color={COLORS.primaryGreen} />
            </View>
          </>
        )}
      </View>

      {renderPreferredCaregiverSection()}
      {renderLocationSection()}

      <TouchableOpacity style={styles.draftButton} onPress={saveDraft}>
        <Icon name="content-save" size={20} color={COLORS.primaryGreen} />
        <Text style={styles.draftButtonText}>Save draft</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.mainButton} onPress={goToMatchmaking}>
        <Text style={styles.mainButtonText}>Find Caregiver</Text>
        <Icon name="magnify" size={24} color="white" style={{ marginLeft: 8 }} />
      </TouchableOpacity>
    </>
  );

  const renderUrgentContent = () => (
    <>
      <View style={styles.emergencyBanner}>
        <Icon name="alarm-light" size={24} color="white" />
        <Text style={styles.emergencyBannerText}>EMERGENCY</Text>
      </View>

      <View style={styles.broadcastCard}>
        <View style={styles.broadcastIconContainer}>
          <Icon name="broadcast" size={24} color="#D93025" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.broadcastTitle}>Immediate Broadcast</Text>
          <Text style={styles.broadcastText}>
            Broadcast to caregivers within 5 miles instantly.
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Nature of Emergency</Text>
        <View style={styles.gridContainer}>
          {['Fall', 'Pain'].map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.gridButton,
                styles.urgentGridButton,
                selectedUrgency === type && styles.urgentGridButtonActive
              ]}
              onPress={() => setSelectedUrgency(type)}
            >
              <Icon
                name={type === 'Fall' ? 'human-wheelchair' : 'bandage'}
                size={32}
                color={selectedUrgency === type ? COLORS.white : "#D93025"}
              />
              <Text style={[
                styles.urgentGridText,
                selectedUrgency === type && { color: COLORS.white }
              ]}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {renderLocationSection()}

      {/* UPDATED: Navigates to EmergencyScreen */}
      <TouchableOpacity
        style={styles.sosButton}
        onPress={() => navigation.navigate('EmergencyScreen', {
          location: selectedLocation,
          locationText,
          urgencyType: selectedUrgency,
        })}
      >
        <Text style={styles.sosButtonText}>BROADCAST SOS NOW</Text>
        <Icon name="broadcast" size={24} color="white" style={{ marginLeft: 8 }} />
      </TouchableOpacity>
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={COLORS.darkText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Request</Text>
        <TouchableOpacity>
          <Text style={styles.resetText}>Reset</Text>
        </TouchableOpacity>
      </View>

      <ErrorBanner error={error} onDismiss={clearError} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderTabs()}
        {activeTab === 'exam' && renderExamContent()}
        {activeTab === 'daily' && renderDailyContent()}
        {activeTab === 'urgent' && renderUrgentContent()}
      </ScrollView>

      {renderDateTimePicker()}
      <BottomNav />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
    paddingTop: Platform.OS === 'android' ? 40 : 10,
    backgroundColor: COLORS.background
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.darkText },
  backButton: { padding: 8, marginLeft: -8 },
  resetText: { color: COLORS.primaryGreen, fontWeight: '600', fontSize: 16 },

  scrollContent: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: 150,
  },

  // Tabs with Animation
  tabContainer: { marginBottom: 24 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#EAEAEA',
    borderRadius: 12,
    padding: TAB_BAR_PADDING,
    marginTop: 8,
    position: 'relative' // Needed for absolute positioning of animated view
  },
  animatedIndicator: {
    position: 'absolute',
    top: TAB_BAR_PADDING,
    left: TAB_BAR_PADDING,
    bottom: TAB_BAR_PADDING,
    width: TAB_WIDTH,
    borderRadius: 10,
    // Background color is handled by interpolation in the component
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    zIndex: 1 // Ensure text sits above the animated background
  },
  // Removed static 'activeTabGreen' style
  tabText: { fontWeight: '600', fontSize: 14, color: COLORS.grayText, marginLeft: 4 },
  activeTabText: { color: 'white' },

  // General Sections
  section: { marginBottom: 24 },
  sectionLabel: { fontSize: 18, fontWeight: 'bold', color: COLORS.darkText, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.darkText, marginBottom: 4 },
  subLabel: { fontSize: 14, color: COLORS.darkText, marginBottom: 8, fontWeight: '500' },

  // Inputs
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primaryGreenLight, borderRadius: 12, paddingHorizontal: 16, height: 50 },
  input: { flex: 1, color: COLORS.darkText, fontSize: 16 },
  inputText: { flex: 1, fontSize: 16, color: COLORS.darkText },

  // Grid Buttons
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  gridButton: { width: (width - 52) / 2, backgroundColor: COLORS.primaryGreenLight, padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', height: 60 },
  gridButtonActive: { backgroundColor: '#D1FAE5', borderWidth: 1, borderColor: COLORS.primaryGreen }, // UPDATED to match
  gridButtonText: { fontSize: 16, fontWeight: '600', color: COLORS.darkText, marginLeft: 8 },
  checkIcon: { position: 'absolute', top: 8, right: 8 },

  // Urgent Specific
  urgentGridButton: { backgroundColor: '#F3F4F6', flexDirection: 'column', height: 100 },
  urgentGridButtonActive: { backgroundColor: '#DC2626' },
  urgentGridText: { fontSize: 16, fontWeight: '600', color: COLORS.darkText, marginTop: 8, marginLeft: 0 },

  // Location
  locationInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primaryGreenLight, borderTopLeftRadius: 12, borderTopRightRadius: 12, paddingHorizontal: 16, height: 50 },
  locationInput: { flex: 1, fontSize: 16, color: COLORS.darkText },
  mapContainer: { height: 200, borderRadius: 12, overflow: 'hidden', marginTop: -4, borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
  map: { width: '100%', height: '100%' },
  mapImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  mapOverlay: { position: 'absolute', bottom: 10, left: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  mapOverlayText: { color: 'white', fontSize: 12, fontWeight: '500' },
  markerContainer: { alignItems: 'center', justifyContent: 'center' },

  // Buttons
  mainButton: { backgroundColor: COLORS.primaryGreen, height: 56, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12, shadowColor: COLORS.primaryGreen, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  mainButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  draftButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingVertical: 12, gap: 8, borderWidth: 1, borderColor: COLORS.primaryGreen, borderRadius: 12 },
  draftButtonText: { color: COLORS.primaryGreen, fontSize: 16, fontWeight: '600' },
  recurringRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  frequencyRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  frequencyChip: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, backgroundColor: COLORS.primaryGreenLight },
  frequencyChipActive: { backgroundColor: '#D1FAE5', borderWidth: 1, borderColor: COLORS.primaryGreen },
  frequencyChipText: { fontSize: 14, fontWeight: '600', color: COLORS.grayText },
  frequencyChipTextActive: { color: COLORS.primaryGreen },
  daysRow: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  dayChip: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primaryGreenLight, alignItems: 'center', justifyContent: 'center' },
  dayChipActive: { backgroundColor: COLORS.primaryGreen },
  dayChipText: { fontSize: 12, fontWeight: '600', color: COLORS.grayText },
  dayChipTextActive: { color: '#FFF' },
  sosButton: { backgroundColor: '#DC2626', height: 56, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12, elevation: 4 },
  sosButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },

  // Emergency Banner
  emergencyBanner: { backgroundColor: '#DC2626', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, marginBottom: 16 },
  emergencyBannerText: { color: 'white', fontSize: 18, fontWeight: 'bold', marginLeft: 8 },
  broadcastCard: { backgroundColor: '#FEE2E2', borderRadius: 12, padding: 16, flexDirection: 'row', marginBottom: 24 },
  broadcastIconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(220, 38, 38, 0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  broadcastTitle: { fontSize: 16, fontWeight: 'bold', color: '#991B1B', marginBottom: 4 },
  broadcastText: { fontSize: 14, color: '#B91C1C', lineHeight: 20 },

  // Preferred caregiver
  preferredCaregiverRow: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  preferredCaregiverAvatar: { width: 36, height: 36, borderRadius: 18 },
  preferredCaregiverAvatarPlaceholder: { backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  preferredCaregiverModal: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '70%', width: '100%' },
  modalEmptyText: { fontSize: 14, color: COLORS.grayText, textAlign: 'center', marginVertical: 24 },
  preferredCaregiverList: { maxHeight: 280, marginBottom: 12 },
  preferredCaregiverItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 12 },
  preferredCaregiverItemText: { fontSize: 16, color: COLORS.darkText, flex: 1 },
  modalCloseButton: { backgroundColor: COLORS.primaryGreenLight, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  modalCloseButtonText: { fontSize: 16, fontWeight: '600', color: COLORS.primaryGreen },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, minHeight: 400 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  dateHeaderContainer: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.darkText, marginHorizontal: 16 },
  navArrow: { padding: 4 },
  closeButton: { position: 'absolute', right: 0 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  calendarDayLabel: { width: '13%', textAlign: 'center', color: COLORS.grayText, marginBottom: 10, fontWeight: '600' },
  calendarCell: { width: '13%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 8, borderRadius: 8, backgroundColor: '#F3F4F6' },
  calendarDateText: { fontSize: 16, color: COLORS.darkText },
  timeOption: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border, flexDirection: 'row', justifyContent: 'space-between' },
  timeOptionDisabled: { opacity: 0.4 },
  timeText: { fontSize: 16, color: COLORS.darkText },
  timeTextDisabled: { color: COLORS.border },

  // Exam time row
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 8 },
  timeInputContainer: { flex: 1 },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  slider: { flex: 1, height: 40 },
  sliderValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primaryGreen,
    minWidth: 44,
    textAlign: 'right',
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 12,
    backgroundColor: COLORS.primaryGreenLight,
    borderRadius: 8,
    gap: 8
  },
  durationText: { fontSize: 16, fontWeight: '600', color: COLORS.primaryGreen },

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

export default NewRequestScreen;