import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Image, Animated, Vibration, StatusBar, Pressable, Linking, Alert } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useAuth } from './context/AuthContext';
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

  const triggerEmergency = async () => {
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
      });

      if (res.emergency_id) {
        setEmergencyId(res.emergency_id);
        setEmergencyStatus('active');
        setAlertSent(true);
      } else {
        setAlertSent(true); // Fallback for old API compatibility
      }
    } catch (error) {
      handleError(error, 'emergency-trigger');
      Alert.alert(
        "Emergency Alert Failed",
        "Could not send digital alert. PLEASE CALL EMERGENCY SERVICES OR CONTACTS MANUALLY.",
        [{ text: "OK" }]
      );
    } finally {
      setLocationLoading(false);
    }
  };

  const acknowledge = async () => {
    if (!emergencyId) return;
    try {
      await api.acknowledgeEmergency(emergencyId);
      setEmergencyStatus('acknowledged');
      Alert.alert("Help Confirmed", "The care recipient has been notified that you are on your way.");
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
              : `Press and hold for ${<Text style={styles.boldText}>3 seconds</Text>}`}
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
            >
              <Animated.View style={[styles.sosButton, { transform: [{ scale: scaleAnim }] }]}>
                {alertSent ? (
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
              : "Location shared: Near 123 Maple Ave"}
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
              >
                <Ionicons name="checkmark-circle" size={24} color="white" style={{ marginRight: 10 }} />
                <Text style={styles.callButtonText}>I am on my way</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.callButton, { backgroundColor: '#3B82F6' }]}
              onPress={() => {
                Alert.alert("Navigation", "Navigating to recipient's location...");
              }}
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
            >
              <Ionicons name="call" size={24} color="white" style={{ marginRight: 10 }} />
              <Text style={styles.callButtonText}>Call Recipient</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cancelButton, { marginTop: 10 }]}
              onPress={resolve}
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
    padding: 5,
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
    fontSize: 14,
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