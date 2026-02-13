import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
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
import { useAuth } from './context/AuthContext';
import { api } from './api/client';

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
  RecipientSchedule: undefined;
  // add others if needed
};

const GREEN = "#059669"; 
const RED = "#EF4444"; 
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
      >
        <Icon name="alert-octagon" size={24} color={RED} />
      </Animated.View>
    </View>
  );
};


const CareRecipientDashboard = () => {
  // Use the typed navigation hook
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { user, refreshUser } = useAuth();

  // --- STATE ---
  const [currentDate, setCurrentDate] = useState("");
  const [greeting, setGreeting] = useState("Good Morning"); 
  // Show modal only if emergency contact is not set
  const [showSosModal, setShowSosModal] = useState(false); 
  const [caretakerName, setCaretakerName] = useState("");
  const [caretakerPhone, setCaretakerPhone] = useState("");
  const [currentBookings, setCurrentBookings] = useState<any[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const scaleValue = useRef(new Animated.Value(0)).current;

  const loadCurrentBookings = async () => {
    try {
      setLoadingBookings(true);
      // Load all bookings (no status filter) to get pending, accepted, and in_progress
      const bookings = await api.getDashboardBookings({ 
        limit: 10 
      });
      // Filter to only show active bookings (pending payment, accepted, or in_progress - not completed)
      const active = (bookings || []).filter((b: any) => 
        b.status === 'pending' || b.status === 'accepted' || b.status === 'in_progress'
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
    } catch (e: any) {
      console.error("Failed to load current bookings:", e);
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
    console.log("Mark as Completed pressed for booking:", bookingId);
    try {
      await api.completeBooking(bookingId);
      console.log("Complete booking API call succeeded for booking:", bookingId);
      await loadCurrentBookings(); // Reload bookings after completion
      Alert.alert("Success", "Booking marked as completed! The caregiver is now available for other requests.");
    } catch (e: any) {
      console.error("Failed to mark booking as completed:", e);
      Alert.alert("Error", e?.message || "Failed to mark booking as completed. Please try again.");
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
      console.error("Failed to save emergency contact:", e);
      Alert.alert("Error", e?.message || "Failed to save emergency contact. Please try again.");
    }
  };

  const displayName = user?.full_name || "Guest";
  const firstName = displayName.split(" ")[0] || displayName;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F6FAF5" />
      
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
              
              <TouchableOpacity style={styles.closeBtn} onPress={handleCloseModal}>
                <Icon name="close" size={20} color="#999" />
              </TouchableOpacity>

              <View style={styles.modalHeader}>
                <View style={styles.modalIconBg}>
                  <Icon name="ambulance" size={28} color={RED} />
                </View>
                <Text style={styles.modalTitle}>Emergency Setup</Text>
              </View>

              <Text style={styles.modalDesc}>
                Please enter your emergency contact's name and mobile number. This contact does not need to be a user of this app. We will use this for <Text style={{fontWeight:'700', color: RED}}>SOS</Text> emergency calls.
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

              <TouchableOpacity style={styles.confirmBtn} onPress={handleSaveContact}>
                <Text style={styles.confirmBtnText}>Confirm & Save</Text>
              </TouchableOpacity>

            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
        
        {/* HEADER */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.date}>{currentDate}</Text> 
            <Text style={styles.heading}>
              {greeting}, {firstName}
            </Text>
          </View>
          
          <TouchableOpacity 
            style={styles.bell}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Icon name="bell-outline" size={24} color="#000" />
            <View style={styles.notificationDot} />
          </TouchableOpacity>
        </View>

        {/* PROFILE CARD */}
        <TouchableOpacity 
          style={styles.profileCard} 
          activeOpacity={0.7}
          onPress={() => navigation.navigate('Profile')}
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
          activeOpacity={0.8}
          onPress={handleNewRequest}
        >
          <Icon name="plus" size={22} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.requestText}>Request New Care</Text>
        </TouchableOpacity>

        {/* SOS SWIPE BUTTON */}
        <SosSwipeButton onSwipeSuccess={handleEmergencySwipe} />


        {/* STATUS SECTION HEADER */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Current Status</Text>
          <TouchableOpacity onPress={() => navigation.navigate('RecipientSchedule')}>
             <Text style={styles.link}>View Schedule</Text>
          </TouchableOpacity>
        </View>

        {/* CURRENT BOOKINGS */}
        {loadingBookings ? (
          <View style={styles.visitCard}>
            <Text style={styles.caregiverText}>Loading...</Text>
          </View>
        ) : currentBookings.length > 0 ? (
          currentBookings.map((booking: any) => {
            const caregiver = booking.caregiver || {};
            const serviceTypeMap: Record<string, string> = {
              'exam_assistance': 'Exam Assistance',
              'daily_care': 'Daily Care',
              'one_time': 'One Time',
              'recurring': 'Recurring',
              'video_call_session': 'Video Call',
            };
            const serviceType = serviceTypeMap[booking.service_type] || booking.service_type;
            const scheduledDate = booking.scheduled_date ? new Date(booking.scheduled_date) : new Date();
            const timeStr = scheduledDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            const dateStr = scheduledDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            return (
              <View key={booking.id} style={styles.visitCard}>
                <View style={styles.mapBox}>
                  <Icon name="map-marker" size={30} color={GREEN} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.visitTitle}>{serviceType}</Text>
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
                    <TouchableOpacity 
                      style={styles.completeBtn}
                      onPress={() => handleMarkCompleted(booking.id)}
                    >
                      <Icon name="check-circle" size={16} color="#fff" style={{ marginRight: 6 }} />
                      <Text style={styles.completeBtnText}>Mark as Completed</Text>
                    </TouchableOpacity>
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
                        
                        navigation.navigate('CaregiverMapScreen', {
                          recipientLocation,
                          recipientName: user?.full_name || 'Care Recipient',
                          caregiverName: caregiver.full_name || 'Caregiver',
                        });
                      }}
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

      {/* BOTTOM NAV */}
      <BottomNav />
      
    </SafeAreaView>
  );
};

export default CareRecipientDashboard;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F6FAF5" },
  
  // --- SWIPE BUTTON STYLES ---
  swipeContainer: {
    height: SWIPE_HEIGHT, backgroundColor: RED, borderRadius: SWIPE_HEIGHT / 2,
    marginHorizontal: 16, marginBottom: 24, justifyContent: 'center', padding: 4,
    shadowColor: RED, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
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
  closeBtn: { position: 'absolute', right: 20, top: 20, zIndex: 1, padding: 4, backgroundColor: '#F3F4F6', borderRadius: 12 },
  modalHeader: { alignItems: 'center', marginBottom: 16 },
  modalIconBg: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  modalDesc: { textAlign: 'center', color: '#6B7280', marginBottom: 24, fontSize: 14, lineHeight: 20 },
  inputContainer: { marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: '#111827' },
  phoneInputRow: { flexDirection: 'row', alignItems: 'center' },
  countryCode: { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB', borderTopLeftRadius: 12, borderBottomLeftRadius: 12, paddingVertical: 13, paddingHorizontal: 12, justifyContent: 'center' },
  countryText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  phoneInput: { flex: 1, backgroundColor: '#F9FAFB', borderWidth: 1, borderLeftWidth: 0, borderColor: '#E5E7EB', borderTopRightRadius: 12, borderBottomRightRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: '#111827' },
  confirmBtn: { backgroundColor: GREEN, paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 8, shadowColor: GREEN, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 4 },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  // --- GENERAL STYLES ---
  headerRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: 12, paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 10, 
    marginTop: Platform.OS === 'android' ? 10 : 0,
  },
  date: { color: GREEN, fontSize: 12, fontWeight: "600", letterSpacing: 1 },
  heading: { fontSize: 26, fontWeight: "700", color: '#1A1A1A' },
  bell: {
    backgroundColor: "#fff", padding: 10, borderRadius: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4,
  },
  notificationDot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: 'red', borderWidth: 1, borderColor: '#fff' },
  
  // Updated Profile Card to be touchable and consistent
  profileCard: {
    backgroundColor: "#fff", borderRadius: 18, padding: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 20, marginHorizontal: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
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
  link: { color: GREEN, fontSize: 13, fontWeight: "600" },
  
  requestBtn: {
    backgroundColor: GREEN, paddingVertical: 16, borderRadius: 18,
    flexDirection: 'row', alignItems: "center", justifyContent: 'center',
    marginBottom: 12, marginHorizontal: 16,
    shadowColor: GREEN, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  requestText: { fontSize: 16, fontWeight: "700", color: '#fff' },
  
  servicesRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24, paddingHorizontal: 16 },
  serviceItem: { alignItems: "center", width: "23%" },
  serviceIcon: {
    backgroundColor: "#fff", width: 60, height: 60, borderRadius: 20,
    alignItems: "center", justifyContent: "center", marginBottom: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  serviceText: { fontSize: 12, fontWeight: '500', color: '#1A1A1A' },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: 'center', marginBottom: 12, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: '#1A1A1A' },
  
  visitCard: {
    backgroundColor: "#fff", borderRadius: 18, padding: 12,
    flexDirection: "row", marginBottom: 24, marginHorizontal: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  mapBox: { width: 90, height: 90, borderRadius: 16, backgroundColor: "#DDEFE3", marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  visitTitle: { fontWeight: "700", fontSize: 16, color: '#1A1A1A' },
  arriving: { color: GREEN, marginTop: 2, marginBottom: 8, fontWeight: "600", fontSize: 13 },
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
  caregiverText: { color: "#555", fontSize: 13 },
  actionRow: { flexDirection: "row", marginTop: 12, alignItems: "center", gap: 8 },
  completeBtn: { 
    backgroundColor: GREEN, 
    paddingVertical: 8, 
    paddingHorizontal: 12, 
    borderRadius: 10, 
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  completeBtnText: { fontWeight: "600", color: "#fff", fontSize: 13 },
  trackBtn: { backgroundColor: "#E9F9EE", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  trackText: { fontWeight: "600", color: GREEN, fontSize: 13 },
  callBtn: { backgroundColor: "#F5F5F5", padding: 8, borderRadius: 10 },
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