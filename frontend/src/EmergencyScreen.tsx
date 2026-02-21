import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Image, Animated, Vibration, StatusBar, Pressable, Linking, Alert, ActivityIndicator, Platform } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useAuth } from './context/AuthContext';
import { useNotification } from './context/NotificationContext';
import { api } from './api/client';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useErrorHandler } from './hooks/useErrorHandler';

const { width } = Dimensions.get('window');

// --- THEME ---
const COLORS = {
  bg: '#180505',          // Very dark red/black background
  primaryRed: '#EF4444',  // Bright Red
  dangerDark: '#991B1B',  // Darker Red
  white: '#FFFFFF',
  grayText: '#A1A1AA',
  buttonGray: '#2C2C2E',
  overlay: 'rgba(239, 68, 68, 0.2)' // Red Glow
};

const EmergencyScreen = ({ navigation, route }: { navigation: any; route?: any }) => {
  const { user } = useAuth();
  const { dismissEmergency } = useNotification();
  const [alertSent, setAlertSent] = useState(false);
  const [emergencyId, setEmergencyId] = useState<string | null>(null);
  const [emergencyStatus, setEmergencyStatus] = useState<'active' | 'acknowledged' | 'resolved' | null>(null);
  const [respondingCaregiver, setRespondingCaregiver] = useState<any>(null);

  const isCaregiver = user?.role === 'caregiver';

  // Robust param handling
  const params = route?.params || {};
  const notification = params.notification;
  const data = notification?.data || params;

  // If caregiver enters via notification, they should have the emergency_id
  const initialEmergencyId = data?.emergency_id || null;

  useEffect(() => {
    if (initialEmergencyId) {
      setEmergencyId(initialEmergencyId);
      setAlertSent(true);
      fetchStatus(initialEmergencyId);
    }
  }, [initialEmergencyId]);

  const fetchStatus = async (id: string) => {
    try {
      const statusRes = await api.getEmergencyStatus(id) as any;
      setEmergencyStatus(statusRes.status);
      if (statusRes.caregiver) {
        setRespondingCaregiver(statusRes.caregiver);
      }
      return statusRes.status;
    } catch (err) {
      console.log("Error fetching emergency status:", err);
      return null;
    }
  };

  // Polling for status updates
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (emergencyId && (emergencyStatus === 'active' || emergencyStatus === 'acknowledged')) {
      interval = setInterval(async () => {
        const status = await fetchStatus(emergencyId);
        if (status === 'resolved') {
          clearInterval(interval);
          Alert.alert("Emergency Resolved", "The situation has been marked as resolved.", [
            { text: "OK", onPress: () => navigation.goBack() }
          ]);
        }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [emergencyId, emergencyStatus]);

  const recipientName = notification?.recipientName || data?.care_recipient_name || 'RECIPIENT';
  const recipientPhoto = data?.care_recipient_photo || 'https://via.placeholder.com/150';
  const locationInfo = data?.location || {};

  // Get emergency contact from user profile
  const emergencyContact = user?.emergency_contact as { name?: string; phone?: string } | null;

  // Animation Values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // --- PRESS AND HOLD LOGIC ---
  const handlePressIn = () => {
    if (alertSent) return;

    // 1. Scale down slightly for feedback
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();

    // 2. Start the 3-second timer animation
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 3000, // 3 Seconds
      useNativeDriver: false, // false because we might animate width/color
    }).start(({ finished }) => {
      if (finished) {
        triggerEmergency();
      }
    });
  };

  const handlePressOut = () => {
    if (alertSent) return;

    // Reset animations if released early
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
    Animated.timing(progressAnim, { toValue: 0, duration: 300, useNativeDriver: false }).start();
  };

  const { handleError } = useErrorHandler();
  const [locationLoading, setLocationLoading] = useState(false);
  const [sharedLocation, setSharedLocation] = useState<{ location_name?: string; latitude?: number; longitude?: number } | null>(null);
  const triggerInProgressRef = useRef(false);

  const triggerEmergency = async () => {
    if (alertSent || triggerInProgressRef.current) return;
    triggerInProgressRef.current = true;
    Vibration.vibrate([0, 500, 200, 500]); // Vibrate pattern
    setLocationLoading(true);

    try {
      let locationData = {
        latitude: 0,
        longitude: 0,
        location_name: "Unknown Location",
        timestamp: new Date().toISOString()
      };

      try {
        // Dynamic import to avoid issues on web if not handled
        const Location = require('expo-location');
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          locationData = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            location_name: "Current Location", // In a real app, reverse geocode here
            timestamp: new Date().toISOString()
          };
        }
      } catch (locError) {
        console.warn("Failed to get location", locError);
      }

      const res = await api.triggerEmergency({
        location: locationData
      }) as { emergency_id?: string };

      if (res.emergency_id) {
        setEmergencyId(res.emergency_id);
        setEmergencyStatus('active');
        setAlertSent(true);
        setSharedLocation(locationData?.latitude != null ? { location_name: locationData.location_name || 'Current Location', latitude: locationData.latitude, longitude: locationData.longitude } : null);
      } else {
        setAlertSent(true);
        setSharedLocation(locationData?.latitude != null ? { location_name: locationData.location_name || 'Current Location', latitude: locationData.latitude, longitude: locationData.longitude } : null);
      }
    } catch (error: any) {
      handleError(error, 'emergency-trigger');
      const isOffline = error?.code === 'NETWORK_ERROR' || error?.code === 'TIMEOUT' || (error?.message && /network|timeout|connection|fetch/i.test(error.message));
      Alert.alert(
        "Emergency Alert Failed",
        isOffline
          ? "You appear to be offline. The app could not send the alert. Call 911 or your emergency contact now."
          : "Could not send digital alert. Please check your connection and try again, or call 911 or your emergency contact now.",
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
      // Remove emergency from caregiver dashboard so it doesn't keep showing after they responded
      dismissEmergency();
      const notificationId = params?.notification?.id;
      if (notificationId) {
        api.markNotificationRead(notificationId).catch(() => {});
      }
    } catch (error) {
      handleError(error, 'emergency-acknowledge');
    }
  };

  const resolve = async () => {
    if (!emergencyId) return;
    try {
      await api.resolveEmergency(emergencyId);
      setEmergencyStatus('resolved');
      navigation.goBack();
    } catch (error) {
      handleError(error, 'emergency-resolve');
    }
  };

  // Interpolate progress for visual feedback (Background Ring Growing)
  const pulseScale = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.5] // Ring grows 1.5x
  });

  const pulseOpacity = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5] // Ring becomes visible
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* --- HEADER --- */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.closeBtn}
          accessibilityLabel="Close emergency screen"
          accessibilityRole="button"
        >
          <Ionicons name="close" size={28} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>EMERGENCY ASSISTANCE</Text>
        <View style={{ width: 28 }} />{/* Spacer for centering */}
      </View>

      <View style={styles.content}>

        {/* --- INSTRUCTIONS --- */}
        <View style={styles.textContainer}>
          <Text style={styles.mainInstruction}>
            {isCaregiver
              ? (emergencyStatus === 'acknowledged' ? "YOU ARE RESPONDING" : "URGENT ASSISTANCE NEEDED")
              : null}
            {!isCaregiver && "Press and hold for "}
            {!isCaregiver && <Text style={styles.boldText}>3 seconds</Text>}
          </Text>
          <Text style={styles.subInstruction}>
            {isCaregiver
              ? (emergencyStatus === 'acknowledged' ? "Help is on the way" : "A client has triggered an emergency alert")
              : "to immediately alert your caregivers"}
          </Text>
        </View>

        {/* --- SOS BUTTON --- */}
        {!isCaregiver && (
          <View style={styles.sosContainer}>
            {/* Animated Background Ring (The Glow/Progress) */}
            <Animated.View
              style={[
                styles.pulseRing,
                {
                  transform: [{ scale: pulseScale }],
                  opacity: pulseOpacity
                }
              ]}
            />

            {/* The Main Red Button */}
            <Pressable
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              disabled={locationLoading}
              accessibilityLabel="Emergency SOS. Press and hold for 3 seconds to send alert."
              accessibilityRole="button"
              accessibilityState={{ disabled: locationLoading, busy: locationLoading }}
              accessibilityHint="Activates emergency alert and shares your location with caregivers when held for 3 seconds."
            >
              <Animated.View style={[styles.sosButton, { transform: [{ scale: scaleAnim }] }]}>
                {locationLoading ? (
                  <ActivityIndicator size="large" color="white" />
                ) : alertSent ? (
                  <Ionicons name="checkmark" size={60} color="white" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="map-marker-alert" size={48} color="white" />
                    <Text style={styles.sosText}>SOS</Text>
                  </>
                )}
              </Animated.View>
            </Pressable>
          </View>
        )}

        {/* --- STATUS & AVATARS --- */}
        <View style={styles.statusContainer}>
          <Text style={[styles.statusText, (isCaregiver || (emergencyStatus === 'acknowledged')) && { color: COLORS.white, fontWeight: 'bold', fontSize: 20 }]}>
            {isCaregiver
              ? `REQUEST FROM ${recipientName}`
              : emergencyStatus === 'acknowledged'
                ? `${respondingCaregiver?.full_name || 'A Caregiver'} IS COMING`
                : alertSent ? "ALERTS SENT SUCCESSFULLY" : "Notifying your caregivers..."}
          </Text>

          {(isCaregiver || (emergencyStatus === 'acknowledged' && respondingCaregiver)) ? (
            <View style={styles.recipientPhotoContainer}>
              <Image
                source={{ uri: isCaregiver ? recipientPhoto : respondingCaregiver.profile_photo_url || 'https://via.placeholder.com/150' }}
                style={styles.recipientLargePhoto}
              />
            </View>
          ) : (
            <View style={styles.avatarRow}>
              <Image
                source={{ uri: 'https://randomuser.me/api/portraits/women/44.jpg' }}
                style={[styles.avatar, { zIndex: 3 }]}
              />
              <Image
                source={{ uri: 'https://randomuser.me/api/portraits/men/32.jpg' }}
                style={[styles.avatar, styles.avatarOverlap, { zIndex: 2 }]}
              />
              <View style={[styles.avatar, styles.avatarOverlap, styles.avatarCount, { zIndex: 1 }]}>
                <Text style={styles.avatarCountText}>+1</Text>
              </View>
            </View>
          )}
        </View>

        {/* --- LOCATION --- */}
        <View style={styles.locationRow}>
          <Ionicons name="location" size={16} color={COLORS.primaryRed} />
          <Text style={styles.locationText}>
            {isCaregiver
              ? `Location: ${locationInfo?.location_name || 'Not provided'}`
              : (sharedLocation?.location_name ? `Location shared: ${sharedLocation.location_name}` : (alertSent ? 'Location shared' : 'Location will be shared when you trigger alert'))}
          </Text>
        </View>

      </View>

      {/* --- FOOTER ACTIONS --- */}
      <View style={styles.footer}>
        {isCaregiver ? (
          <>
            {emergencyStatus === 'active' && (
              <TouchableOpacity
                style={[styles.callButton, { backgroundColor: '#10B981' }]}
                onPress={acknowledge}
                accessibilityLabel="I am on my way. Confirm you are responding."
                accessibilityRole="button"
              >
                <Ionicons name="checkmark-circle" size={24} color="white" style={{ marginRight: 10 }} />
                <Text style={styles.callButtonText}>I am on my way</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.callButton, { backgroundColor: '#3B82F6' }]}
              onPress={() => {
                const lat = locationInfo?.latitude ?? data?.latitude;
                const lng = locationInfo?.longitude ?? data?.longitude;
                if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
                  const url = Platform.OS === 'web' ? `https://www.google.com/maps?q=${lat},${lng}` : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
                  Linking.openURL(url).catch(() => Alert.alert("Error", "Could not open maps."));
                } else {
                  Alert.alert("Location Unavailable", "Recipient's location was not shared. Try calling them instead.");
                }
              }}
              accessibilityLabel="Open maps to navigate to recipient location"
              accessibilityRole="button"
            >
              <Ionicons name="navigate" size={24} color="white" style={{ marginRight: 10 }} />
              <Text style={styles.callButtonText}>Navigate to Location</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.callButton}
              onPress={() => {
                if (data?.care_recipient_phone) {
                  Linking.openURL(`tel:${data.care_recipient_phone}`);
                } else if (respondingCaregiver?.phone) {
                  Linking.openURL(`tel:${respondingCaregiver.phone}`);
                } else {
                  Alert.alert("Error", "Contact number not available.");
                }
              }}
              accessibilityLabel="Call recipient"
              accessibilityRole="button"
            >
              <Ionicons name="call" size={24} color="white" style={{ marginRight: 10 }} />
              <Text style={styles.callButtonText}>Call Recipient</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cancelButton, { marginTop: 10 }]}
              onPress={resolve}
              accessibilityLabel="Mark emergency as resolved"
              accessibilityRole="button"
            >
              <Text style={[styles.cancelText, { color: '#ef4444' }]}>Mark as Resolved</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={styles.callButton}
              onPress={() => {
                if (emergencyContact?.phone) {
                  Linking.openURL(`tel:${emergencyContact.phone}`);
                } else if (respondingCaregiver?.phone) {
                  Linking.openURL(`tel:${respondingCaregiver.phone}`);
                } else {
                  Linking.openURL('tel:911');
                }
              }}
              accessibilityLabel={emergencyContact?.phone ? `Call ${emergencyContact.name || 'emergency contact'}` : respondingCaregiver?.phone ? `Call ${respondingCaregiver.full_name}` : 'Call 911'}
              accessibilityRole="button"
            >
              <Ionicons name="call" size={24} color="white" style={{ marginRight: 10 }} />
              <Text style={styles.callButtonText}>
                {emergencyContact?.phone
                  ? `Call ${emergencyContact.name || 'Emergency Contact'}`
                  : respondingCaregiver?.phone ? `Call ${respondingCaregiver.full_name}` : 'Call 911 Directly'}
              </Text>
            </TouchableOpacity>

            {(emergencyStatus === 'active' || emergencyStatus === 'acknowledged') && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={resolve}
              >
                <Text style={styles.cancelText}>Mark as Resolved</Text>
              </TouchableOpacity>
            ) || (
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => navigation.goBack()}
                >
                  <Text style={styles.cancelText}>Cancel Request</Text>
                </TouchableOpacity>
              )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    marginBottom: 40,
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  closeBtn: {
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  content: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },

  // Text Instructions
  textContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  mainInstruction: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  boldText: {
    fontWeight: '800',
  },
  subInstruction: {
    color: COLORS.grayText,
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },

  // SOS Button Area
  sosContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 50,
  },
  pulseRing: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: COLORS.primaryRed,
  },
  sosButton: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: COLORS.primaryRed,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primaryRed,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 4,
    borderColor: '#FCA5A5',
  },
  sosText: {
    color: COLORS.white,
    fontSize: 32,
    fontWeight: '900',
    marginTop: 5,
    letterSpacing: 2,
  },

  // Caregiver Status
  statusContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  statusText: {
    color: COLORS.grayText,
    fontSize: 16,
    marginBottom: 15,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  avatarRow: {
    flexDirection: 'row',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: COLORS.bg,
  },
  avatarOverlap: {
    marginLeft: -15,
  },
  avatarCount: {
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCountText: {
    color: COLORS.white,
    fontWeight: 'bold',
  },

  // Location
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  locationText: {
    color: '#D1D5DB',
    marginLeft: 6,
    fontSize: 16,
  },

  // Footer Actions
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  callButton: {
    backgroundColor: COLORS.buttonGray,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    marginBottom: 20,
  },
  callButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '700',
  },
  cancelButton: {
    alignItems: 'center',
    padding: 10,
  },
  cancelText: {
    color: COLORS.grayText,
    fontSize: 16,
  },
  recipientPhotoContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  recipientLargePhoto: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 4,
    borderColor: COLORS.primaryRed,
  },
});

export default EmergencyScreen;