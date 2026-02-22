import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Animated, Vibration, StatusBar, Pressable, Linking, Alert, ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useAuth } from './context/AuthContext';
import { useNotification } from './context/NotificationContext';
import { api } from './api/client';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useErrorHandler } from './hooks/useErrorHandler';
import { accessibility as a11y } from './theme';
import LeafletMap from './components/LeafletMap';

const COLORS = {
  bg: '#0F0F0F',
  card: '#1A1A1A',
  cardBorder: '#2A2A2A',
  primaryRed: '#DC2626',
  primaryRedLight: 'rgba(220, 38, 38, 0.15)',
  green: '#059669',
  greenLight: 'rgba(5, 150, 105, 0.2)',
  blue: '#2563EB',
  blueLight: 'rgba(37, 99, 235, 0.2)',
  white: '#FFFFFF',
  gray: '#A3A3A3',
  grayDark: '#525252',
};

const EmergencyScreen = ({ navigation, route }: { navigation: any; route?: any }) => {
  const { width, height } = useWindowDimensions();
  const mapHeight = Math.min(200, Math.max(140, height * 0.26));
  const { user } = useAuth();
  const { dismissEmergency } = useNotification();
  const [alertSent, setAlertSent] = useState(false);
  const [emergencyId, setEmergencyId] = useState<string | null>(null);
  const [emergencyStatus, setEmergencyStatus] = useState<'active' | 'acknowledged' | 'resolved' | null>(null);
  const [respondingCaregiver, setRespondingCaregiver] = useState<any>(null);

  const isCaregiver = user?.role === 'caregiver';
  const params = route?.params || {};
  const notification = params.notification;
  const data = notification?.data || params;
  // Support emergency_id (snake_case) and emergencyId (camelCase) from any entry point (dashboard, notifications list, push)
  const initialEmergencyId = data?.emergency_id ?? params?.emergency_id ?? params?.emergencyId ?? null;
  const locationInfo = data?.location || {} as Record<string, unknown>;

  useEffect(() => {
    if (initialEmergencyId) {
      setEmergencyId(initialEmergencyId);
      setAlertSent(true);
      fetchStatus(initialEmergencyId);
    }
  }, [initialEmergencyId]);

  // Set map location from notification/params when caregiver opens (location may be in data.location)
  useEffect(() => {
    const loc = locationInfo?.latitude != null && locationInfo?.longitude != null
      ? { latitude: Number(locationInfo.latitude), longitude: Number(locationInfo.longitude) }
      : null;
    if (loc && !emergencyMapLocation) setEmergencyMapLocation(loc);
  }, [locationInfo?.latitude, locationInfo?.longitude]);

  const fetchStatus = async (id: string) => {
    try {
      const statusRes = await api.getEmergencyStatus(id) as any;
      setEmergencyStatus(statusRes.status);
      if (statusRes.caregiver) setRespondingCaregiver(statusRes.caregiver);
      const loc = statusRes?.location;
      if (loc && typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
        setEmergencyMapLocation({ latitude: loc.latitude, longitude: loc.longitude });
      }
      return statusRes.status;
    } catch (err) {
      console.log("Error fetching emergency status:", err);
      return null;
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (emergencyId && (emergencyStatus === 'active' || emergencyStatus === 'acknowledged')) {
      interval = setInterval(async () => {
        const status = await fetchStatus(emergencyId);
        if (status === 'resolved') {
          clearInterval(interval);
          Alert.alert("Resolved", "The emergency has been marked as resolved.", [
            { text: "OK", onPress: () => navigation.goBack() }
          ]);
        }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [emergencyId, emergencyStatus]);

  const recipientName = notification?.recipientName || data?.care_recipient_name || 'Recipient';
  const recipientPhoto = data?.care_recipient_photo || 'https://via.placeholder.com/150';
  const emergencyContact = user?.emergency_contact as { name?: string; phone?: string } | null;

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressTimingRef = useRef<Animated.CompositeAnimation | null>(null);
  const holdCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [holdCountdown, setHoldCountdown] = useState<number | null>(null);

  const clearHoldCountdown = () => {
    if (holdCountdownRef.current) {
      clearInterval(holdCountdownRef.current);
      holdCountdownRef.current = null;
    }
    setHoldCountdown(null);
  };

  const handlePressIn = () => {
    if (alertSent) return;
    setHoldCountdown(3);
    holdCountdownRef.current = setInterval(() => {
      setHoldCountdown(prev => {
        if (prev === null || prev <= 1) {
          if (holdCountdownRef.current) clearInterval(holdCountdownRef.current);
          holdCountdownRef.current = null;
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true }).start();
    progressTimingRef.current = Animated.timing(progressAnim, { toValue: 1, duration: 3000, useNativeDriver: false });
    progressTimingRef.current.start(({ finished }) => {
      progressTimingRef.current = null;
      clearHoldCountdown();
      if (finished) triggerEmergency();
    });
  };

  const handlePressOut = () => {
    if (alertSent) return;
    clearHoldCountdown();
    if (progressTimingRef.current) {
      progressTimingRef.current.stop();
      progressTimingRef.current = null;
    }
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
    Animated.timing(progressAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  };

  const { handleError } = useErrorHandler();
  const [locationLoading, setLocationLoading] = useState(false);
  const [sharedLocation, setSharedLocation] = useState<{ location_name?: string; latitude?: number; longitude?: number } | null>(null);
  /** Emergency/recipient location for map (from API or shared after trigger). */
  const [emergencyMapLocation, setEmergencyMapLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const triggerInProgressRef = useRef(false);

  const triggerEmergency = async () => {
    if (alertSent || triggerInProgressRef.current) return;
    triggerInProgressRef.current = true;
    if (Platform.OS !== 'web') Vibration.vibrate([0, 400, 200, 400]);
    setLocationLoading(true);

    try {
      let locationData: any = { latitude: 0, longitude: 0, location_name: "Unknown", timestamp: new Date().toISOString() };
      try {
        const Location = require('expo-location');
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          locationData = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            location_name: "Current Location",
            timestamp: new Date().toISOString()
          };
        }
      } catch (_) {}

      const res = await api.triggerEmergency({ location: locationData }) as {
        emergency_id?: string;
        status?: string;
        message?: string;
        caregivers_notified?: number;
      };
      if (res.emergency_id) {
        setEmergencyId(res.emergency_id);
        setEmergencyStatus('active');
      }
      setAlertSent(true);
      if (locationData?.latitude != null && locationData?.longitude != null) {
        setSharedLocation({ location_name: locationData.location_name || 'Current Location', latitude: locationData.latitude, longitude: locationData.longitude });
        setEmergencyMapLocation({ latitude: locationData.latitude, longitude: locationData.longitude });
      }
      const isStub = res.emergency_id?.startsWith?.('stub-');
      const noCaregivers = (res.caregivers_notified ?? 0) === 0;
      if (isStub || (noCaregivers && res.status !== 'error')) {
        Alert.alert(
          isStub ? 'Alert recorded (setup incomplete)' : 'Alert sent',
          isStub
            ? (res.message || 'Emergency table is not set up. Contact support. Call 911 or your emergency contact now if needed.')
            : 'No caregivers were notified (none linked). Call your emergency contact or 911 if you need help now.',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      handleError(error, 'emergency-trigger');
      const isOffline = error?.message && /network|timeout|connection|fetch/i.test(String(error.message));
      Alert.alert(
        "Alert could not be sent",
        isOffline
          ? "You appear to be offline. Please call 911 or your emergency contact now."
          : "Please check your connection and try again, or call 911 or your emergency contact now.",
        [{ text: "OK" }]
      );
    } finally {
      setLocationLoading(false);
      triggerInProgressRef.current = false;
    }
  };

  const acknowledge = async () => {
    if (!emergencyId) return;
    try {
      await api.acknowledgeEmergency(emergencyId);
      setEmergencyStatus('acknowledged');
      dismissEmergency();
      if (params?.notification?.id) api.markNotificationRead(params.notification.id).catch(() => {});
    } catch (error) {
      handleError(error, 'emergency-acknowledge');
    }
  };

  const resolve = async () => {
    if (!emergencyId) {
      Alert.alert(
        'Cannot resolve',
        'Emergency session is missing. Please open this screen from the emergency notification or dashboard alert.',
        [{ text: 'OK' }]
      );
      return;
    }
    try {
      const result = await api.resolveEmergency(emergencyId) as { status?: string; message?: string };
      if (result?.status === 'error') {
        Alert.alert('Could not resolve', result?.message || 'The emergency could not be marked as resolved. Please try again.', [{ text: 'OK' }]);
        return;
      }
      setEmergencyStatus('resolved');
      dismissEmergency();
      if (params?.notification?.id) api.markNotificationRead(params.notification.id).catch(() => {});
      navigation.goBack();
    } catch (error) {
      handleError(error, 'emergency-resolve');
    }
  };

  const progressBarWidth = Math.max(200, width - 80);
  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: [0, progressBarWidth] });

  const openMaps = () => {
    const lat = locationInfo?.latitude ?? data?.latitude;
    const lng = locationInfo?.longitude ?? data?.longitude;
    if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
      const url = Platform.OS === 'web' ? `https://www.google.com/maps?q=${lat},${lng}` : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
      Linking.openURL(url).catch(() => Alert.alert("Error", "Could not open maps."));
    } else {
      Alert.alert("Location unavailable", "Recipient's location was not shared.");
    }
  };

  const callRecipient = () => {
    const phone = data?.care_recipient_phone || respondingCaregiver?.phone;
    if (phone) Linking.openURL(`tel:${phone}`);
    else Alert.alert("Error", "Contact number not available.");
  };

  const callEmergency = () => {
    const phone = emergencyContact?.phone || respondingCaregiver?.phone;
    if (phone) Linking.openURL(`tel:${phone}`);
    else Linking.openURL('tel:911');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.iconButton}
          accessibilityLabel="Close emergency screen"
          accessibilityRole="button"
          accessibilityHint="Returns to the previous screen"
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} accessibilityRole="header">Emergency</Text>
        <View style={styles.iconButton} />
      </View>

      <View style={styles.main}>
        {/* Single card: Assistance needed + Location + Map (all on one page) */}
        <View style={styles.onePageCard}>
          {/* Row 1: Status + Name (compact) */}
          <View style={styles.statusRowCompact}>
            <View style={[styles.statusDot, { backgroundColor: isCaregiver ? (emergencyStatus === 'acknowledged' ? COLORS.green : COLORS.primaryRed) : (alertSent ? (emergencyStatus === 'acknowledged' ? COLORS.green : COLORS.primaryRed) : COLORS.grayDark) }]} />
            <Text style={styles.statusLabelBold}>
              {isCaregiver
                ? (emergencyStatus === 'acknowledged' ? 'You are responding' : 'Assistance needed')
                : (emergencyStatus === 'acknowledged' ? `${respondingCaregiver?.full_name || 'A caregiver'} is on the way` : alertSent ? 'Alerts sent' : 'Ready to send alert')}
            </Text>
          </View>
          <View style={styles.nameRow}>
            <Image source={{ uri: isCaregiver ? recipientPhoto : (respondingCaregiver?.profile_photo_url || 'https://via.placeholder.com/80') }} style={styles.avatarSmall} />
            <Text style={styles.cardTitleCompact}>{isCaregiver ? recipientName : (alertSent ? 'Your alert is active' : 'Care recipient')}</Text>
          </View>

          {/* SOS (care recipient only) - compact */}
          {!isCaregiver && (
            <View style={styles.sosSectionCompact}>
              <Text style={[styles.sosHintCompact, holdCountdown !== null && styles.sosHintCompactHighlight]}>
                {locationLoading ? 'Sending…' : holdCountdown !== null ? `Hold… ${holdCountdown}` : 'Press and hold 3s to send'}
              </Text>
              <View style={[styles.sosProgressBg, { maxWidth: progressBarWidth }]}>
                <Animated.View style={[styles.sosProgressFill, { width: progressWidth }]} />
              </View>
              <Pressable
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={locationLoading}
                style={({ pressed }) => [{ opacity: pressed ? 0.95 : 1 }]}
                accessibilityLabel={alertSent ? 'Emergency alert sent' : 'Send emergency alert'}
                accessibilityRole="button"
                accessibilityHint={alertSent ? 'Alert sent' : 'Press and hold 3 seconds'}
                accessibilityState={{ disabled: locationLoading, busy: locationLoading }}
              >
                <Animated.View style={[styles.sosButtonCompact, { transform: [{ scale: scaleAnim }] }]}>
                  {locationLoading ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : alertSent ? (
                    <Ionicons name="checkmark-circle" size={36} color={COLORS.white} />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="alert-octagon" size={28} color={COLORS.white} />
                      <Text style={styles.sosLabelCompact}>SOS</Text>
                    </>
                  )}
                </Animated.View>
              </Pressable>
            </View>
          )}

          {/* Row 2: Location label + value */}
          <View style={styles.locationRow}>
            <Ionicons name="location" size={18} color={COLORS.primaryRed} />
            <Text style={styles.locationValueCompact} numberOfLines={1}>
              {isCaregiver
                ? (locationInfo?.location_name || 'Location not shared')
                : (sharedLocation?.location_name || (alertSent ? 'Shared with caregivers' : 'Shared when you send alert'))}
            </Text>
          </View>

          {/* Row 3: Map (fixed height so everything fits) */}
          {emergencyMapLocation ? (
            <View style={[styles.mapWrap, { height: mapHeight }]}>
              <LeafletMap
                center={{ lat: emergencyMapLocation.latitude, lng: emergencyMapLocation.longitude }}
                zoom={14}
                markers={[{ id: 'emergency', lat: emergencyMapLocation.latitude, lng: emergencyMapLocation.longitude, label: isCaregiver ? recipientName : 'Your location' }]}
                style={[styles.map, { height: mapHeight }]}
              />
            </View>
          ) : (
            <View style={[styles.mapPlaceholder, { height: mapHeight }]}>
              <MaterialCommunityIcons name="map-marker-off" size={32} color={COLORS.gray} />
              <Text style={styles.mapPlaceholderText}>Map when location is shared</Text>
            </View>
          )}

          {/* Open in Maps - only when we have location */}
          {(emergencyMapLocation || locationInfo?.latitude != null) && (
            <TouchableOpacity style={styles.openMapsBtn} onPress={openMaps} activeOpacity={0.8} accessibilityLabel="Open in Maps" accessibilityRole="button">
              <Ionicons name="navigate" size={20} color={COLORS.white} />
              <Text style={styles.openMapsBtnText}>Open in Maps</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          {isCaregiver ? (
            <>
              {emergencyStatus === 'active' && (
                <TouchableOpacity
                  style={[styles.button, styles.buttonPrimary]}
                  onPress={acknowledge}
                  activeOpacity={0.8}
                  accessibilityLabel="I'm on my way"
                  accessibilityRole="button"
                  accessibilityHint="Tells the care recipient you are responding"
                >
                  <Ionicons name="checkmark-circle" size={24} color={COLORS.white} />
                  <Text style={styles.buttonPrimaryText}>I'm on my way</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={openMaps}
                activeOpacity={0.8}
                accessibilityLabel="Navigate to location"
                accessibilityRole="button"
                accessibilityHint="Opens maps with the recipient's location"
              >
                <Ionicons name="navigate" size={22} color={COLORS.white} />
                <Text style={styles.buttonSecondaryText}>Navigate to location</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={callRecipient}
                activeOpacity={0.8}
                accessibilityLabel="Call recipient"
                accessibilityRole="button"
                accessibilityHint="Opens phone to call the care recipient"
              >
                <Ionicons name="call" size={22} color={COLORS.white} />
                <Text style={styles.buttonSecondaryText}>Call recipient</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.textButton}
                onPress={resolve}
                accessibilityLabel="Mark as resolved"
                accessibilityRole="button"
                accessibilityHint="Marks this emergency as resolved"
              >
                <Text style={styles.textButtonLabel}>Mark as resolved</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.button, styles.buttonPrimary]}
                onPress={callEmergency}
                activeOpacity={0.8}
                accessibilityLabel={emergencyContact?.phone ? `Call ${emergencyContact.name || 'emergency contact'}` : respondingCaregiver?.phone ? `Call ${respondingCaregiver.full_name}` : 'Call 911'}
                accessibilityRole="button"
                accessibilityHint="Opens phone to call for help"
              >
                <Ionicons name="call" size={24} color={COLORS.white} />
                <Text style={styles.buttonPrimaryText}>
                  {emergencyContact?.phone ? `Call ${emergencyContact.name || 'emergency contact'}` : respondingCaregiver?.phone ? `Call ${respondingCaregiver.full_name}` : 'Call 911'}
                </Text>
              </TouchableOpacity>
              {(emergencyStatus === 'active' || emergencyStatus === 'acknowledged') ? (
                <TouchableOpacity
                  style={styles.textButton}
                  onPress={resolve}
                  accessibilityLabel="Mark as resolved"
                  accessibilityRole="button"
                  accessibilityHint="Marks this emergency as resolved"
                >
                  <Text style={styles.textButtonLabel}>Mark as resolved</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.textButton}
                  onPress={() => navigation.goBack()}
                  accessibilityLabel="Cancel"
                  accessibilityRole="button"
                  accessibilityHint="Leave emergency screen without sending alert"
                >
                  <Text style={styles.textButtonLabel}>Cancel</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  headerTitle: { color: COLORS.white, fontSize: 18, fontWeight: '700' },
  iconButton: {
    minWidth: a11y.minTouchTargetSize,
    minHeight: a11y.minTouchTargetSize,
    justifyContent: 'center',
    alignItems: 'center',
  },
  main: { flex: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  onePageCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  statusRowCompact: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  statusLabelBold: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatarSmall: { width: 36, height: 36, borderRadius: 18, marginRight: 10 },
  cardTitleCompact: { color: COLORS.white, fontSize: 17, fontWeight: '700', flex: 1 },
  sosSectionCompact: { alignItems: 'center', marginVertical: 10 },
  sosHintCompact: { color: COLORS.gray, fontSize: 12, marginBottom: 6 },
  sosHintCompactHighlight: { color: COLORS.primaryRed, fontWeight: '700' },
  sosProgressBg: { width: '100%', height: 4, backgroundColor: COLORS.cardBorder, borderRadius: 2, overflow: 'hidden', marginBottom: 6 },
  sosProgressFill: { height: '100%', backgroundColor: COLORS.primaryRed, borderRadius: 2 },
  sosButtonCompact: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.primaryRed,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  sosLabelCompact: { color: COLORS.white, fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 },
  locationValueCompact: { color: COLORS.white, fontSize: 14, flex: 1 },
  mapPlaceholder: { backgroundColor: COLORS.cardBorder, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  mapPlaceholderText: { color: COLORS.gray, fontSize: 13, marginTop: 6 },
  openMapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: COLORS.blue,
  },
  openMapsBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '600' },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  cardLabel: { color: COLORS.gray, fontSize: 13, marginLeft: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  cardTitle: { color: COLORS.white, fontSize: 20, fontWeight: '700', marginBottom: 12 },
  locationValue: { color: COLORS.white, fontSize: 16 },
  mapWrap: { overflow: 'hidden', borderRadius: 12, backgroundColor: COLORS.cardBorder },
  map: { height: 220, width: '100%' },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusLabel: { color: COLORS.gray, fontSize: 14 },
  avatarLarge: { width: 80, height: 80, borderRadius: 40, alignSelf: 'center', marginTop: 8 },

  sosSection: { alignItems: 'center', marginVertical: 24 },
  sosHint: { color: COLORS.gray, fontSize: 14, marginBottom: 16 },
  sosWrap: { alignItems: 'center', justifyContent: 'center' },
  progressBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: COLORS.cardBorder,
    borderRadius: 3,
    marginTop: 20,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primaryRed,
    borderRadius: 3,
  },
  sosButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: COLORS.primaryRed,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: COLORS.primaryRed,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  sosLabel: { color: COLORS.white, fontSize: 28, fontWeight: '800', marginTop: 4, letterSpacing: 1 },

  actions: { marginTop: 8 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: a11y.minTouchTargetSize,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
    marginBottom: 12,
    gap: 10,
  },
  buttonPrimary: { backgroundColor: COLORS.green },
  buttonPrimaryText: { color: COLORS.white, fontSize: 17, fontWeight: '700' },
  buttonSecondary: { backgroundColor: COLORS.blue },
  buttonSecondaryText: { color: COLORS.white, fontSize: 16, fontWeight: '600' },
  textButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: a11y.minTouchTargetSize,
    paddingVertical: 14,
  },
  textButtonLabel: { color: COLORS.gray, fontSize: 15 },
});

export default EmergencyScreen;
