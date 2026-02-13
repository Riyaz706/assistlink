import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

const BottomNav = () => {
  // Use <any> to allow navigating to any screen without strict type errors
  const navigation = useNavigation<any>();
  
  // Safe check for route
  const route = useRoute<any>();

  // Helper to determine if a tab is active
  const isActive = (screenName: string) => route?.name === screenName;

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={styles.container}>
      
      {/* 1. Home Tab */}
      <TouchableOpacity 
        style={styles.tab} 
        onPress={() => navigation.navigate('CareRecipientDashboard')}
      >
        <Icon 
          name={isActive('CareRecipientDashboard') ? "home" : "home-outline"} 
          size={28} 
          color={isActive('CareRecipientDashboard') ? "#059669" : "#666"} 
        />
        <Text style={[styles.label, isActive('CareRecipientDashboard') && styles.activeLabel]}>Home</Text>
      </TouchableOpacity>

      {/* 2. Schedule Tab */}
      <TouchableOpacity 
        style={styles.tab}
        onPress={() => navigation.navigate('Schedule')} 
      >
        <Icon 
          name={isActive('Schedule') ? "calendar-clock" : "calendar-clock-outline"} 
          size={28} 
          color={isActive('Schedule') ? "#059669" : "#666"} 
        />
        <Text style={[styles.label, isActive('Schedule') && styles.activeLabel]}>Schedule</Text>
      </TouchableOpacity>

      {/* 3. Messages Tab */}
      <TouchableOpacity 
        style={styles.tab} 
        onPress={() => navigation.navigate('ChatList')} 
      >
        <Icon 
          name={isActive('ChatList') ? "message-text" : "message-text-outline"} 
          size={28} 
          color={isActive('ChatList') ? "#059669" : "#666"} 
        />
        <Text style={[styles.label, isActive('ChatList') && styles.activeLabel]}>Messages</Text>
      </TouchableOpacity>

      {/* 4. Profile Tab */}
      <TouchableOpacity 
        style={styles.tab}
        onPress={() => navigation.navigate('Profile')} 
      >
        <Icon 
          name={isActive('Profile') ? "account-circle" : "account-circle-outline"} 
          size={28} 
          color={isActive('Profile') ? "#059669" : "#666"} 
        />
        <Text style={[styles.label, isActive('Profile') && styles.activeLabel]}>Profile</Text>
      </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FFFFFF',
  },
  container: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 70,
    paddingBottom: Platform.OS === 'android' ? 8 : 10,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
  },
  label: {
    fontSize: 10,
    marginTop: 4,
    color: '#666',
  },
  activeLabel: {
    color: '#059669',
    fontWeight: 'bold',
  }
});

export default BottomNav ;