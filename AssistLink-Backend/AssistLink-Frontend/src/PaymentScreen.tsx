import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { api } from './api/client';
import { useAuth } from './context/AuthContext';

const THEME = {
  primary: "#059669",
  bg: "#F9FAFB",
  card: "#FFFFFF",
  text: "#111827",
  subText: "#4B5563",
};

export default function PaymentScreen({ route, navigation }: any) {
  const appointment = route.params?.appointment;
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);

  if (!appointment) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontSize: 16, marginBottom: 20 }}>Error: No appointment details found.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.payBtn}>
          <Text style={styles.payText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const payNow = async () => {
    setCreatingOrder(true);
    try {
      // Step 1: Create payment order (bypasses Razorpay and directly enables chat)
      const amount = appointment.price || appointment.amount || 500;
      console.log('[PaymentScreen] Creating payment order for booking:', appointment.id);
      
      const orderResponse = await api.createPaymentOrder({
        booking_id: appointment.id,
        amount: amount,
        currency: 'INR'
      });

      console.log('[PaymentScreen] Payment order created:', orderResponse);
      setCreatingOrder(false);
      
      // If chat_session_id is returned, chat is already enabled (bypass mode)
      if (orderResponse.chat_session_id) {
        Alert.alert(
          "Success", 
          "Chat has been enabled successfully!",
          [
            {
              text: "Open Chat",
              onPress: () => {
                navigation.navigate('ChatList', {
                  chat_session_id: orderResponse.chat_session_id,
                  booking_id: appointment.id
                });
              }
            },
            {
              text: "OK",
              onPress: () => {
                navigation.navigate('CareRecipientDashboard');
              }
            }
          ]
        );
      } else {
        // Fallback: If no chat_session_id, try to navigate to chat anyway
        Alert.alert(
          "Success", 
          "Payment processed successfully!",
          [
            {
              text: "Open Chat",
              onPress: () => {
                navigation.navigate('ChatList');
              }
            },
            {
              text: "OK",
              onPress: () => {
                navigation.navigate('CareRecipientDashboard');
              }
            }
          ]
        );
      }

    } catch (e: any) {
      console.error("[PaymentScreen] Error creating payment order:", e);
      setCreatingOrder(false);
      setLoading(false);
      Alert.alert("Error", e.message || "Failed to process payment. Please try again.");
    }
  };


  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
           <Icon name="arrow-left" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confirm Payment</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          {appointment.caregiver?.profile_photo_url ? (
            <Image 
              source={{ uri: appointment.caregiver.profile_photo_url }} 
              style={styles.avatar} 
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Icon name="account" size={32} color="#6B7280" />
            </View>
          )}
          <Text style={styles.name}>
            {appointment.caregiver?.full_name || appointment.caregiver || 'Caregiver'}
          </Text>
          <Text style={styles.role}>
            {appointment.role || appointment.service_type || 'Service'}
          </Text>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.label}>Service</Text>
            <Text style={styles.value}>
              {appointment.service || appointment.service_type || 'N/A'}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Date</Text>
            <Text style={styles.value}>
              {appointment.date || (appointment.scheduled_date ? new Date(appointment.scheduled_date).toLocaleDateString() : 'N/A')}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Time</Text>
            <Text style={styles.value}>
              {appointment.time || (appointment.scheduled_date ? new Date(appointment.scheduled_date).toLocaleTimeString() : 'N/A')}
            </Text>
          </View>

          <View style={styles.amountBox}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.amount}>₹{appointment.price || 500}</Text>
          </View>

          <TouchableOpacity 
            style={[styles.payBtn, (loading || creatingOrder) && styles.payBtnDisabled]} 
            onPress={payNow} 
            disabled={loading || creatingOrder}
          >
            {(loading || creatingOrder) ? (
               <ActivityIndicator color="#fff" />
            ) : (
               <Text style={styles.payText}>Pay Now</Text>
            )}
          </TouchableOpacity>
          
          {(creatingOrder || loading) && (
            <Text style={styles.loadingText}>
              {creatingOrder ? 'Creating payment order...' : 'Processing payment...'}
            </Text>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', 
    padding: 20, paddingBottom: 10 
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#000' },
  
  content: { padding: 20 },
  card: {
    backgroundColor: THEME.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.05, shadowRadius: 10, elevation: 3,
  },
  avatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 12 },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  name: { fontSize: 20, fontWeight: '700', color: THEME.text },
  role: { color: THEME.subText, marginBottom: 20, fontSize: 14 },

  divider: { width: '100%', height: 1, backgroundColor: '#F3F4F6', marginBottom: 20 },

  row: {
    width: '100%', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14,
  },
  label: { color: THEME.subText, fontSize: 15 },
  value: { color: THEME.text, fontWeight: '600', fontSize: 15 },

  amountBox: {
    width: '100%', marginVertical: 24, padding: 16, borderRadius: 14,
    backgroundColor: '#ECFDF5', flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', borderWidth: 1, borderColor: '#D1FAE5'
  },
  totalLabel: { fontSize: 16, color: '#065F46' },
  amount: { fontSize: 22, fontWeight: 'bold', color: '#059669' },

  payBtn: {
    backgroundColor: THEME.primary, width: '100%', paddingVertical: 16,
    borderRadius: 14, alignItems: 'center',
    shadowColor: THEME.primary, shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  payBtnDisabled: { opacity: 0.7 },
  payText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  loadingText: {
    marginTop: 12,
    fontSize: 12,
    color: THEME.subText,
    textAlign: 'center'
  },
});

