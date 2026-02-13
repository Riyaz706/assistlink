import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Dimensions, Image } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const GREEN = "#059669";

const UpcomingVisitScreen = () => {
  const navigation = useNavigation();

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
      </SafeAreaView>

      {/* --- MAP PLACEHOLDER --- */}
      {/* In a real app, use <MapView> here */}
      <View style={styles.mapContainer}>
        <View style={styles.mapPlaceholder}>
           {/* Mock Map Details */}
           <View style={styles.road} />
           <View style={[styles.road, { transform: [{ rotate: '90deg' }] }]} />
           
           {/* User Location */}
           <View style={styles.userLocation}>
             <View style={styles.userDot} />
           </View>

           {/* Caregiver Location (Car) */}
           <View style={styles.carLocation}>
             <Icon name="car" size={24} color="#fff" />
           </View>

           <Text style={styles.mapLabel}>Map View Placeholder</Text>
        </View>
      </View>

      {/* --- BOTTOM SHEET INFO --- */}
      <View style={styles.bottomSheet}>
        
        {/* Time Estimation */}
        <View style={styles.timeContainer}>
          <Text style={styles.timeText}>Arriving in 15 mins</Text>
          <Text style={styles.subTimeText}>10:30 AM • On Time</Text>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '70%' }]} />
          </View>
        </View>

        {/* Caregiver Profile */}
        <View style={styles.profileRow}>
          <Image 
            source={{ uri: 'https://randomuser.me/api/portraits/men/32.jpg' }} 
            style={styles.avatar} 
          />
          <View style={styles.profileInfo}>
            <Text style={styles.caregiverName}>Michael Johnson</Text>
            <View style={styles.ratingRow}>
              <Icon name="star" size={14} color="#FBBF24" />
              <Text style={styles.ratingText}>4.9 • Nursing Care</Text>
            </View>
          </View>
          
          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.iconBtn}>
              <Icon name="message-processing-outline" size={22} color={GREEN} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.iconBtn, styles.callBtn]}>
              <Icon name="phone" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.cancelButton}>
          <Text style={styles.cancelText}>Cancel Visit</Text>
        </TouchableOpacity>

      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
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
  },
  cancelText: {
    color: '#EF4444',
    fontWeight: '600',
    fontSize: 15,
  },
});

export default UpcomingVisitScreen;