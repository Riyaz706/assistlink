import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Modal,
  Switch,
  Dimensions,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import { api } from './api/client';

const { width } = Dimensions.get('window');

// Helper function to parse date string like "Oct 15, 2025, 10:00 AM"
const parseDateTimeString = (dateTimeStr: string): Date | null => {
  if (!dateTimeStr || typeof dateTimeStr !== 'string') {
    return null;
  }

  try {
    // Try parsing as-is first (works for ISO strings)
    const directParse = new Date(dateTimeStr);
    if (!isNaN(directParse.getTime())) {
      return directParse;
    }

    // Parse format like "Oct 15, 2025, 10:00 AM"
    // Split by comma
    const parts = dateTimeStr.split(',');
    if (parts.length >= 2) {
      const datePart = parts[0].trim(); // "Oct 15"
      const yearPart = parts[1].trim().split(' ')[0]; // "2025"
      const timePart = parts[1].trim().substring(yearPart.length).trim(); // "10:00 AM"

      // Parse time
      const [time, period] = timePart.split(' ');
      const [hours, minutes] = time.split(':').map(Number);
      let hour24 = hours;
      if (period === 'PM' && hours !== 12) {
        hour24 = hours + 12;
      } else if (period === 'AM' && hours === 12) {
        hour24 = 0;
      }

      // Parse date
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const [monthName, day] = datePart.split(' ');
      const monthIndex = monthNames.indexOf(monthName);

      if (monthIndex !== -1 && day && yearPart) {
        const date = new Date(parseInt(yearPart), monthIndex, parseInt(day), hour24, minutes || 0);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }

    return null;
  } catch (e) {
    console.error('Error parsing date:', e);
    return null;
  }
};

const MatchmakingScreen = ({ navigation }: any) => {
  const route = useRoute<any>();
  const { serviceType, assistanceType, examDateTime, dailyDateTime, examDuration, dailyDuration, locationText } =
    route.params || {};

  // --- STATE MANAGEMENT ---
  const [activeTab, setActiveTab] = useState('Top Rated');
  const [isFilterVisible, setFilterVisible] = useState(false);

  // Selection Popup State
  const [selectionModalVisible, setSelectionModalVisible] = useState(false);
  const [selectedCaregiver, setSelectedCaregiver] = useState<any>(null);

  // Booking Flow State: 'type' | 'success'
  const [bookingStep, setBookingStep] = useState<'type' | 'success'>('type');

  // Filter States
  const [onlyOnline, setOnlyOnline] = useState(false);
  const [genderFilter, setGenderFilter] = useState('Any');

  const [caregivers, setCaregivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Always refresh caregivers whenever this screen gains focus,
  // so that recently completed bookings immediately free caregivers
  // and make them available in matchmaking.
  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;

      const loadCaregivers = async () => {
        setLoading(true);
        setError(null);
        try {
          console.log('[Matchmaking] Loading caregivers...');
          const data = await api.listCaregivers({ limit: 20 });
          console.log('[Matchmaking] Received caregivers from API:', data);
          console.log('[Matchmaking] Number of caregivers:', (data as any[])?.length || 0);

          // Normalize shape for UI
          const mapped = (data as any[]).map((c) => {
            // Handle caregiver_profile which might be a dict or a list (Supabase relationship)
            let profile = c.caregiver_profile;
            if (Array.isArray(profile)) {
              profile = profile[0] || null;
            }
            const availability = profile?.availability_status;
            console.log(`[Matchmaking] Caregiver ${c.id} (${c.full_name}): availability_status=${availability}, profile type=${Array.isArray(c.caregiver_profile) ? 'array' : typeof c.caregiver_profile}`);
            return {
              id: c.id,
              name: c.full_name || 'Caregiver',
              role:
                profile?.bio ||
                'Experienced caregiver',
              price: profile?.hourly_rate || 0,
              rating: profile?.avg_rating || 0,
              reviews: profile?.total_reviews || 0,
              image: c.profile_photo_url || null,
              tags: profile?.skills || [],
              qualifications: profile?.qualifications || [],
              distance: 0,
              distanceStr: '',
              status: availability === 'available' ? 'online' : 'offline',
              gender: 'Any',
            };
          });

          console.log('[Matchmaking] Mapped caregivers for UI:', mapped.length);
          if (isActive) {
            setCaregivers(mapped);
          }
        } catch (e: any) {
          if (isActive) {
            setError(e?.message || 'Failed to load caregivers');
          }
        } finally {
          if (isActive) {
            setLoading(false);
          }
        }
      };

      loadCaregivers();

      return () => {
        isActive = false;
      };
    }, [])
  );

  // --- LOGIC ---
  const getDisplayData = () => {
    let data = [...caregivers];
    if (activeTab === 'Top Rated') data.sort((a, b) => b.rating - a.rating);
    else if (activeTab === 'Nearest') data.sort((a, b) => a.distance - b.distance);
    else if (activeTab === 'Lowest Price') data.sort((a, b) => a.price - b.price);

    if (genderFilter !== 'Any') data = data.filter(c => c.gender === genderFilter);
    if (onlyOnline) data = data.filter(c => c.status === 'online');
    return data;
  };

  const displayedCaregivers = getDisplayData();

  // --- HANDLERS ---
  const handleSelectPress = (item: any) => {
    setSelectedCaregiver(item);
    setBookingStep('type');
    setSelectionModalVisible(true);
  };

  const handleCloseSelection = () => {
    setSelectionModalVisible(false);
    setSelectedCaregiver(null);
    setBookingStep('type');
  };

  // --- RENDER HELPERS ---
  const renderSelectionModal = () => {
    if (!selectedCaregiver) return null;

    const isVideoCall = !serviceType || serviceType === 'video_call';
    const serviceTitle = serviceType === 'exam_assistance' ? 'Exam Assistance' :
      serviceType === 'daily_care' ? 'Daily Care' :
        serviceType === 'one_time' ? 'Urgent Care' : 'Video Call';

    return (
      <Modal
        animationType="fade"
        transparent={true}
        visible={selectionModalVisible}
        onRequestClose={handleCloseSelection}
      >
        <View style={styles.popupOverlay}>
          <View style={styles.popupContainer}>

            {/* Header Icons */}
            {bookingStep !== 'success' && (
              <TouchableOpacity style={styles.popupCloseBtn} onPress={handleCloseSelection}>
                <Ionicons name="close" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            )}


            {/* STEP 1: SUCCESS VIEW (ZOOM OR SESSION CONFIRMED) */}
            {bookingStep === 'success' ? (
              <View style={styles.successContainer}>
                <View style={styles.successIconCircle}>
                  <Ionicons name="checkmark" size={48} color="#FFF" />
                </View>
                <Text style={styles.successTitle}>Request Sent!</Text>
                <Text style={styles.successSubtitle}>
                  Your {isVideoCall ? 'video call' : 'booking'} request has been sent to {selectedCaregiver.name.split(',')[0]}.
                  Once they accept, you will be notified{isVideoCall ? ' to join the call' : ' to proceed with payment'}.
                </Text>
                <TouchableOpacity
                  style={styles.successDoneBtn}
                  onPress={() => {
                    handleCloseSelection();
                    // Navigate back to dashboard to see the new booking
                    navigation.navigate('CareRecipientDashboard');
                  }}
                >
                  <Text style={styles.successDoneBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : bookingStep === 'type' ? (
              /* STEP 2: BOOKING CONFIRMATION */
              <>
                <View style={styles.popupHeader}>
                  {selectedCaregiver.image ? (
                    <Image source={{ uri: selectedCaregiver.image }} style={styles.popupAvatar} />
                  ) : (
                    <View style={styles.popupAvatarPlaceholder}>
                      <MaterialCommunityIcons name="account" size={40} color="#6B7280" />
                    </View>
                  )}
                  <Text style={styles.popupTitle}>Book for {serviceTitle}?</Text>
                  <Text style={styles.popupSubtitle}>
                    {isVideoCall
                      ? "Request a 15-second video call with this caregiver."
                      : `Request ${serviceTitle} with ${selectedCaregiver.name.split(',')[0]}.`}
                  </Text>
                </View>

                <View style={styles.popupActions}>
                  <TouchableOpacity
                    style={[styles.popupButton, { backgroundColor: '#059669', marginTop: 0 }]}
                    onPress={async () => {
                      try {
                        console.log('📞 Creating request for caregiver:', selectedCaregiver.id);

                        // Parse date more robustly
                        let when: Date;
                        const dateToParse = serviceType === 'daily_care' ? dailyDateTime : examDateTime;

                        if (dateToParse && typeof dateToParse === 'string') {
                          const parsed = parseDateTimeString(dateToParse);
                          when = parsed || new Date();
                        } else {
                          when = new Date();
                          if (isVideoCall) when.setHours(when.getHours() + 1);
                        }

                        if (isVideoCall) {
                          console.log('Creating Video Call Request');
                          const created = await api.createVideoCallRequest({
                            caregiver_id: selectedCaregiver.id,
                            scheduled_time: when.toISOString(),
                            duration_seconds: 15,
                          });

                          // Auto-accept on behalf of care recipient so status moves forward
                          if ((created as any)?.id) {
                            await api.acceptVideoCallRequest((created as any).id, true);
                          }
                        } else {
                          console.log('Creating Booking Request: ', serviceType);

                          // Parse duration string (e.g. "2h 30m" -> 2.5)
                          const durationStr = serviceType === 'daily_care' ? dailyDuration : examDuration;
                          let durationHours = 1.0; // Fallback

                          if (durationStr) {
                            try {
                              const hoursMatch = durationStr.match(/(\d+)h/);
                              const minsMatch = durationStr.match(/(\d+)m/);
                              const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
                              const mins = minsMatch ? parseInt(minsMatch[1]) : 0;
                              durationHours = hours + (mins / 60);
                            } catch (e) {
                              console.warn('Failed to parse duration, defaulting to 1.0');
                            }
                          }

                          // Construct location object
                          const bookingLocation = route.params?.location ? {
                            ...route.params.location,
                            address: locationText
                          } : { latitude: 0, longitude: 0, address: locationText };

                          await api.createBooking({
                            caregiver_id: selectedCaregiver.id,
                            service_type: serviceType,
                            scheduled_date: when.toISOString(),
                            duration_hours: durationHours,
                            location: bookingLocation,
                            specific_requirements: route.params?.specificRequirements || assistanceType, // Use specificRequirements
                            urgency_level: route.params?.urgencyLevel || 'standard'
                          });
                        }

                        setBookingStep('success');
                      } catch (e: any) {
                        console.error('❌ Error creating request:', e);
                        Alert.alert('Error', e?.message || 'Failed to create request. Please try again.');
                        // Do not proceed to success on error
                      }
                    }}
                  >
                    <Ionicons name={isVideoCall ? "videocam" : "calendar"} size={20} color="#FFF" style={{ marginRight: 8 }} />
                    <View>
                      <Text style={styles.popupButtonTitle}>{isVideoCall ? "Book Video Call" : "Send Booking Request"}</Text>
                      <Text style={styles.popupButtonSub}>{isVideoCall ? "15-sec intro session" : "Wait for acceptance"}</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    );
  };

  const renderCaregiver = ({ item }: { item: any }) => {
    const isBusy = item.status === 'busy';
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            {item.image ? (
              <Image source={{ uri: item.image }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <MaterialCommunityIcons name="account" size={30} color="#6B7280" />
              </View>
            )}
            {item.status === 'online' && <View style={styles.onlineBadge}><View style={styles.onlineDot} /></View>}
            {isBusy && <View style={styles.busyBadge}><Text style={styles.busyText}>BUSY</Text></View>}
          </View>
          <View style={styles.cardInfo}>
            <View style={styles.rowBetween}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.price}>${item.price}<Text style={styles.perHour}>/hr</Text></Text>
            </View>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color="#059669" />
              <Text style={styles.ratingText}> {item.rating} <Text style={styles.reviews}>({item.reviews} reviews)</Text></Text>
            </View>
            <Text style={styles.roleText} numberOfLines={2}>{item.role}</Text>
          </View>
        </View>
        <View style={styles.tagRow}>
          {item.tags.map((tag: string, i: number) => (
            <View key={`skill-${i}`} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>
          ))}
          {item.qualifications.map((qual: string, i: number) => (
            <View key={`qual-${i}`} style={[styles.tag, styles.qualTag]}><Text style={styles.qualTagText}>{qual}</Text></View>
          ))}
        </View>
        <View style={styles.cardFooter}>
          <View style={styles.distanceRow}>
            <Ionicons name="location-sharp" size={16} color="#666" />
            <Text style={styles.distanceText}>{item.distanceStr}</Text>
          </View>
          <View style={styles.actionButtons}>
            {isBusy ? (
              <View style={styles.unavailableBtn}><Text style={styles.unavailableText}>Unavail.</Text></View>
            ) : (
              <TouchableOpacity style={styles.profileBtn}><Text style={styles.profileBtnText}>Profile</Text></TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.selectBtn, isBusy && styles.selectBtnDisabled]}
              disabled={isBusy}
              onPress={() => handleSelectPress(item)}
            >
              <Text style={[styles.selectBtnText, isBusy && styles.selectBtnTextDisabled]}>Select</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FA" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Caregiver</Text>
        <TouchableOpacity onPress={() => setFilterVisible(true)}>
          <Ionicons name="options-outline" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.fastMatchContainer}>
          <View style={styles.fastMatchContent}>
            <View style={styles.fastMatchHeader}>
              <Ionicons name="flash" size={18} color="#059669" />
              <Text style={styles.fastMatchTitle}> Fast Match</Text>
            </View>
            <Text style={styles.fastMatchDesc}>Instantly match with the highest-rated available caregiver.</Text>
            <TouchableOpacity style={styles.autoAssignBtn}><Text style={styles.autoAssignText}>Auto-Assign Now</Text></TouchableOpacity>
          </View>
          <View style={styles.graphicPlaceholder}>
            <View style={styles.graphicLine1} />
            <View style={styles.graphicLine2} />
          </View>
        </View>

        <View style={styles.filterRow}>
          {['Top Rated', 'Nearest', 'Lowest Price'].map((tab) => (
            <TouchableOpacity key={tab} style={[styles.filterChip, activeTab === tab && styles.filterChipActive]} onPress={() => setActiveTab(tab)}>
              {activeTab === tab && <Ionicons name="checkmark" size={14} color="#059669" style={{ marginRight: 4 }} />}
              <Text style={activeTab === tab ? styles.filterTextActive : styles.filterText}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Available ({displayedCaregivers.length})</Text>
          <TouchableOpacity><Text style={styles.viewMapText}>View Map</Text></TouchableOpacity>
        </View>

        <View style={styles.listContainer}>
          {displayedCaregivers.map((item) => <View key={item.id}>{renderCaregiver({ item })}</View>)}
        </View>
      </ScrollView>

      {/* FILTER MODAL */}
      <Modal animationType="slide" transparent={true} visible={isFilterVisible} onRequestClose={() => setFilterVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Options</Text>
              <TouchableOpacity onPress={() => setFilterVisible(false)}><Ionicons name="close" size={24} color="#333" /></TouchableOpacity>
            </View>
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>Show Online Only</Text>
              <Switch value={onlyOnline} onValueChange={setOnlyOnline} trackColor={{ false: "#767577", true: "#059669" }} />
            </View>
            <Text style={styles.modalLabel}>Gender</Text>
            <View style={styles.genderRow}>
              {['Any', 'Female', 'Male'].map((g) => (
                <TouchableOpacity key={g} style={[styles.genderChip, genderFilter === g && styles.genderChipActive]} onPress={() => setGenderFilter(g)}>
                  <Text style={genderFilter === g ? styles.genderTextActive : styles.genderText}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.applyBtn} onPress={() => setFilterVisible(false)}><Text style={styles.applyBtnText}>Apply Filters</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* POPUP SELECTION & SUCCESS CONTAINER */}
      {renderSelectionModal()}

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  scrollContainer: { paddingBottom: 120 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#F5F7FA' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  fastMatchContainer: { marginHorizontal: 20, backgroundColor: '#FFF', borderRadius: 16, padding: 20, flexDirection: 'row', justifyContent: 'space-between', overflow: 'hidden', shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, marginBottom: 20 },
  fastMatchContent: { flex: 0.7 },
  fastMatchHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  fastMatchTitle: { fontWeight: '800', fontSize: 16 },
  fastMatchDesc: { fontSize: 12, color: '#666', marginBottom: 15, lineHeight: 18 },
  autoAssignBtn: { backgroundColor: '#059669', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  autoAssignText: { fontWeight: '800', fontSize: 13, color: '#FFF' },
  graphicPlaceholder: { width: 80, height: 80, backgroundColor: '#064E3B', borderRadius: 8, overflow: 'hidden', justifyContent: 'center' },
  graphicLine1: { height: 10, backgroundColor: '#34D399', marginBottom: 10, opacity: 0.5, transform: [{ rotate: '-10deg' }], width: 100, marginLeft: -10 },
  graphicLine2: { height: 20, backgroundColor: '#34D399', opacity: 0.8, transform: [{ rotate: '-5deg' }], width: 100, marginLeft: -10 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 20 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFF', marginRight: 10, borderWidth: 1, borderColor: '#FFF', shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 2 },
  filterChipActive: { borderColor: '#059669', flexDirection: 'row', alignItems: 'center', backgroundColor: '#D1FAE5' },
  filterText: { fontSize: 13, fontWeight: '600', color: '#666' },
  filterTextActive: { fontSize: 13, fontWeight: '700', color: '#059669' },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 15 },
  listTitle: { fontSize: 18, fontWeight: '800' },
  viewMapText: { color: '#059669', fontWeight: '700', fontSize: 13 },
  listContainer: { paddingHorizontal: 20 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 15, marginBottom: 15, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 5 },
  cardHeader: { flexDirection: 'row', marginBottom: 12 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#EEE' },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineBadge: { position: 'absolute', bottom: 0, right: 0, width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  onlineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#059669', borderWidth: 2, borderColor: '#FFF' },
  busyBadge: { position: 'absolute', bottom: -5, left: 5, right: 5, backgroundColor: '#333', borderRadius: 4, paddingVertical: 2, alignItems: 'center' },
  busyText: { color: '#FFF', fontSize: 8, fontWeight: '800' },
  cardInfo: { flex: 1, marginLeft: 15 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  name: { fontSize: 16, fontWeight: '800', marginBottom: 2 },
  price: { fontSize: 16, fontWeight: '800' },
  perHour: { fontSize: 12, fontWeight: '400', color: '#666' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  ratingText: { fontWeight: '700', fontSize: 12 },
  reviews: { color: '#888', fontWeight: '400' },
  roleText: { fontSize: 12, color: '#666', lineHeight: 16 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 15, marginLeft: 75 },
  tag: { backgroundColor: '#F0F2F5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginRight: 6, marginBottom: 5 },
  tagText: { fontSize: 11, color: '#555', fontWeight: '600' },
  qualTag: { backgroundColor: '#E0F2F1', borderColor: '#B2DFDB', borderWidth: 1 },
  qualTagText: { fontSize: 11, color: '#059669', fontWeight: '700' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  distanceRow: { flexDirection: 'row', alignItems: 'center' },
  distanceText: { marginLeft: 5, fontSize: 13, color: '#666', fontWeight: '500' },
  actionButtons: { flexDirection: 'row' },
  profileBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#E0E0E0', marginRight: 10 },
  profileBtnText: { fontWeight: '700', fontSize: 13, color: '#333' },
  selectBtn: { backgroundColor: '#059669', paddingHorizontal: 20, paddingVertical: 9, borderRadius: 8 },
  selectBtnText: { fontWeight: '800', fontSize: 13, color: '#FFF' },
  unavailableBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#EEE', marginRight: 10 },
  unavailableText: { fontWeight: '600', fontSize: 13, color: '#AAA' },
  selectBtnDisabled: { backgroundColor: '#E0E0E0' },
  selectBtnTextDisabled: { color: '#888' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, minHeight: 300 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  modalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalLabel: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 10 },
  genderRow: { flexDirection: 'row', marginBottom: 30 },
  genderChip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: '#F5F7FA', marginRight: 10, borderWidth: 1, borderColor: '#F5F7FA' },
  genderChipActive: { backgroundColor: '#D1FAE5', borderColor: '#059669' },
  genderText: { fontWeight: '600', color: '#666' },
  genderTextActive: { fontWeight: '700', color: '#059669' },
  applyBtn: { backgroundColor: '#059669', paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  applyBtnText: { fontSize: 16, fontWeight: '800', color: '#FFF' },

  popupOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  popupContainer: { width: '100%', maxWidth: 360, backgroundColor: '#FFF', borderRadius: 24, padding: 24, alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  popupCloseBtn: { position: 'absolute', top: 16, right: 16, padding: 4, zIndex: 10 },
  popupBackBtn: { position: 'absolute', top: 16, left: 16, padding: 4, zIndex: 10 },
  popupHeader: { alignItems: 'center', marginBottom: 24 },
  popupAvatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 16, borderWidth: 3, borderColor: '#F5F7FA' },
  popupAvatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#F5F7FA',
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popupTitle: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 8, textAlign: 'center' },
  popupSubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20, paddingHorizontal: 10 },
  popupActions: { width: '100%' },
  popupButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 16, width: '100%' },
  popupButtonTitle: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  popupButtonSub: { fontSize: 11, color: 'rgba(255,255,255,0.8)', textAlign: 'center', fontWeight: '500' },

  // --- SUCCESS CONTAINER STYLES ---
  successContainer: { alignItems: 'center', paddingVertical: 10, width: '100%' },
  successIconCircle: {
    width: 90, height: 90, borderRadius: 45, backgroundColor: '#059669',
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
    shadowColor: "#059669", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8
  },
  successTitle: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 12 },
  successSubtitle: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 30, paddingHorizontal: 5 },
  successDoneBtn: { backgroundColor: '#F3F4F6', paddingVertical: 16, borderRadius: 16, width: '100%', alignItems: 'center' },
  successDoneBtnText: { color: '#111827', fontWeight: '700', fontSize: 16 },

  calendarTitle: { fontSize: 18, fontWeight: '800', color: '#111827', alignSelf: 'center', marginBottom: 20, marginTop: 5 },
  monthSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingHorizontal: 10 },
  monthText: { fontSize: 16, fontWeight: '700', color: '#333' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', marginBottom: 20 },
  dayLabel: { width: '14.28%', textAlign: 'center', fontSize: 12, fontWeight: '600', color: '#9CA3AF', marginBottom: 10 },
  dateCell: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 20, marginBottom: 5 },
  dateCellSelected: { backgroundColor: '#059669', shadowColor: "#059669", shadowOpacity: 0.3, shadowRadius: 5 },
  dateText: { fontSize: 14, fontWeight: '600', color: '#333' },
  dateTextSelected: { color: '#FFF', fontWeight: '700' },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 10, paddingLeft: 5 },
  timeContainer: { marginBottom: 25 },
  timeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', marginRight: 10, backgroundColor: '#FFF' },
  timeChipSelected: { borderColor: '#059669', backgroundColor: '#ECFDF5' },
  timeText: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
  timeTextSelected: { color: '#059669', fontWeight: '700' },
  confirmBtn: { backgroundColor: '#059669', width: '100%', paddingVertical: 16, borderRadius: 16, alignItems: 'center', shadowColor: "#059669", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  confirmBtnDisabled: { backgroundColor: '#D1D5DB', shadowOpacity: 0 },
  confirmBtnText: { fontSize: 16, fontWeight: '800', color: '#FFF' },
});

export default MatchmakingScreen;