import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Dimensions, StatusBar, Modal, Platform, Animated, Easing, Alert, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { api } from './api/client';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useErrorHandler, ErrorDetails } from './hooks/useErrorHandler';

// Conditional imports for native modules (not available on web)
let Location: any = null;
let MapView: any = null;
let Marker: any = null;
let PROVIDER_DEFAULT: any = null;

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

// Import react-native-maps (only works in development builds, not in Expo Go)
// Metro config will replace this with a mock in Expo Go
try {
  const Maps = require('react-native-maps');
  // Check if this is the mock (won't have native properties) or real maps
  if (Maps && Maps.MapView) {
    MapView = Maps.default || Maps.MapView || Maps;
    Marker = Maps.Marker;
    PROVIDER_DEFAULT = Maps.PROVIDER_DEFAULT;

    // Check if this is the mock: mock sets PROVIDER_DEFAULT to undefined
    // Real react-native-maps would have a PROVIDER_DEFAULT value
    if (PROVIDER_DEFAULT === undefined && MapView && typeof MapView === 'function') {
      // This is the mock - use fallback instead
      MapView = null;
      Marker = null;
      PROVIDER_DEFAULT = undefined;
    }
  }
} catch (e) {
  // If require fails, Metro should have replaced it with mock, but just in case:
  console.warn('react-native-maps not available, using fallback:', e);
}

// Web fallback components - use if MapView is null or if we detected it's the mock
if (!MapView) {
  MapView = ({ children, style, onPress, ...props }: any) => (
    <View style={[style, { backgroundColor: '#EBF4EF', justifyContent: 'center', alignItems: 'center', padding: 20, minHeight: 300 }]}>
      <Icon name="map-marker-off" size={64} color="#059669" />
      <Text style={{ color: '#1F2937', fontSize: 18, fontWeight: '600', marginTop: 16, textAlign: 'center' }}>
        Map View Unavailable
      </Text>
      <Text style={{ color: '#6B7280', fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 20, lineHeight: 20 }}>
        {Platform.OS === 'web'
          ? 'Map features are only available on mobile devices. Please use the Android app for full functionality.'
          : 'Map features require a development build and are not available in Expo Go. Please build the app using "npx expo run:android" to enable map features.'}
      </Text>
      {children}
    </View>
  );
  Marker = ({ children }: any) => <View>{children}</View>;
  PROVIDER_DEFAULT = undefined;
}

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
  background: '#F8F9FA',
  primaryGreen: '#059669',      // <--- UPDATED DARKER GREEN
  primaryGreenLight: '#ECFDF5', // <--- UPDATED MINT LIGHT GREEN
  urgentRed: '#DC2626',
  urgentRedLight: '#FEE2E2',
  darkText: '#1A1A1A',
  grayText: '#6B7280',
  white: '#FFFFFF',
  border: '#E5E7EB'
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

type TabType = 'exam' | 'daily' | 'urgent';

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
    outputRange: [COLORS.primaryGreen, COLORS.primaryGreen, COLORS.urgentRed],
  });

  const [selectedAssistance, setSelectedAssistance] = useState<string>('scribe');
  const [selectedUrgency, setSelectedUrgency] = useState<string | null>(null);

  const [isPickerVisible, setPickerVisible] = useState(false);
  const [pickerStep, setPickerStep] = useState<'date' | 'startTime' | 'endTime'>('date');
  const [currentPickingMode, setCurrentPickingMode] = useState<'exam' | 'daily'>('exam');
  const [pickingTimeType, setPickingTimeType] = useState<'startTime' | 'endTime'>('startTime');

  // Exam date & time states
  const [examDate, setExamDate] = useState<string>('');
  const [examStartTime, setExamStartTime] = useState<string>('');
  const [examEndTime, setExamEndTime] = useState<string>('');
  const [examDuration, setExamDuration] = useState<string>('');

  // Daily date & time states
  const [dailyDate, setDailyDate] = useState<string>('');
  const [dailyStartTime, setDailyStartTime] = useState<string>('');
  const [dailyEndTime, setDailyEndTime] = useState<string>('');
  const [dailyDuration, setDailyDuration] = useState<string>('');
  const [tempDate, setTempDate] = useState('');
  const [viewDate, setViewDate] = useState(new Date());

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

    // Build a simple payload to help filter caregivers and pre-fill booking
    const payload: any = {
      serviceType: activeTab === 'exam' ? 'exam_assistance' : activeTab === 'daily' ? 'daily_care' : 'one_time',
      assistanceType: activeTab === 'exam' ? selectedAssistance : null,
      examDate: examDate,
      examStartTime: examStartTime,
      examEndTime: examEndTime,
      examDuration: examDuration,
      dailyDate: dailyDate,
      dailyStartTime: dailyStartTime,
      dailyEndTime: dailyEndTime,
      dailyDuration: dailyDuration,
      locationText,
      location: selectedLocation, // Include coordinates
    };
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
  const mapRef = useRef<any>(null);

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

      // Animate map to location
      if (mapRef.current && mapRef.current.animateToRegion) {
        mapRef.current.animateToRegion({
          ...mapRegion,
          latitude: newLocation.latitude,
          longitude: newLocation.longitude,
        }, 1000);
      }
    } catch (error: any) {
      handleError(error, 'location-error');
    } finally {
      setLocationLoading(false);
    }
  };

  // Handle map press to select location
  const handleMapPress = (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    const newLocation = { latitude, longitude };
    setSelectedLocation(newLocation);

    // Reverse geocode to get address
    if (Location && Location.reverseGeocodeAsync) {
      Location.reverseGeocodeAsync(newLocation)
        .then((addresses: any) => {
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
        })
        .catch((e: any) => {
          console.warn('Reverse geocoding failed:', e);
          setLocationText('Selected Location');
        });
    }
  };

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
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          initialRegion={mapRegion}
          onPress={handleMapPress}
          showsUserLocation={false}
          showsMyLocationButton={false}
          mapType="standard"
        >
          {selectedLocation && (
            <Marker
              coordinate={selectedLocation}
              title="Selected Location"
              description={locationText || "Tap on map to select location"}
            >
              <View style={styles.markerContainer}>
                <Icon name="map-marker" size={40} color={COLORS.primaryGreen} />
              </View>
            </Marker>
          )}
        </MapView>
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
          <TextInput style={styles.input} placeholder="e.g. Calculus II, History 101" placeholderTextColor={COLORS.grayText} />
          <Icon name="book-open-variant" size={20} color={COLORS.primaryGreen} />
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
            <Text style={styles.durationText}>Duration: {examDuration}</Text>
          </View>
        )}
      </View>

      {renderLocationSection()}

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
            <Text style={styles.durationText}>Duration: {dailyDuration}</Text>
          </View>
        )}
      </View>

      {renderLocationSection()}

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
    <SafeAreaView style={styles.container}>
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
    paddingHorizontal: 20,
    paddingTop: 20,
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
  sosButton: { backgroundColor: '#DC2626', height: 56, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12, elevation: 4 },
  sosButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },

  // Emergency Banner
  emergencyBanner: { backgroundColor: '#DC2626', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, marginBottom: 16 },
  emergencyBannerText: { color: 'white', fontSize: 18, fontWeight: 'bold', marginLeft: 8 },
  broadcastCard: { backgroundColor: '#FEE2E2', borderRadius: 12, padding: 16, flexDirection: 'row', marginBottom: 24 },
  broadcastIconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(220, 38, 38, 0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  broadcastTitle: { fontSize: 16, fontWeight: 'bold', color: '#991B1B', marginBottom: 4 },
  broadcastText: { fontSize: 14, color: '#B91C1C', lineHeight: 20 },

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