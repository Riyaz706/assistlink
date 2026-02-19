import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { api } from './api/client';

const PaymentScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { bookingId } = route.params;
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    try {
      setLoading(true);
      console.log("[PaymentScreen] Initiating payment for booking:", bookingId);

      // 1. Create Payment Order on Backend
      // The amount is hardcoded to 50 for now as per the UI, but should ideally come from route params or booking data
      const amount = 50;
      const order = await api.createPaymentOrder({
        booking_id: bookingId,
        amount: amount,
        currency: 'INR'
      });

      console.log("[PaymentScreen] Order created:", order);

      // 2. Handle Bypass Mode (Development/Testing)
      if (order.key_id === 'bypass' || order.key_id === 'completed' || order.order_id.startsWith('completed_')) {
        console.log("[PaymentScreen] Payment bypassed or already completed by backend");
        Alert.alert("Success", "Payment confirmed via bypass mode!", [
          { text: "OK", onPress: () => navigation.navigate("BookingsScreen") }
        ]);
        return;
      }

      // 3. Simulated Razorpay Flow
      // In a real production app with Razorpay SDK:
      // RazorpayCheckout.open(options).then((data) => { ... })

      console.log("[PaymentScreen] Simulating Razorpay checkout for order:", order.order_id);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 4. Verify Payment on Backend
      // We simulate the signature that Razorpay would provide
      const mockVerification = {
        razorpay_order_id: order.order_id,
        razorpay_payment_id: "pay_mock_" + Math.random().toString(36).substring(7),
        razorpay_signature: "sig_mock_" + Math.random().toString(36).substring(7),
      };

      console.log("[PaymentScreen] Verifying mock payment:", mockVerification);

      const verificationResponse = await api.verifyPayment(mockVerification);
      console.log("[PaymentScreen] Verification response:", verificationResponse);

      Alert.alert("Success", "Payment Successful and Booking Confirmed!", [
        { text: "OK", onPress: () => navigation.navigate("BookingsScreen") }
      ]);
    } catch (error: any) {
      console.error("[PaymentScreen] Payment error:", error);
      Alert.alert("Error", error.message || "Payment Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment</Text>
      </View>

      <View style={styles.content}>
        <Ionicons name="card-outline" size={80} color="#007AFF" style={styles.icon} />
        <Text style={styles.amount}>$50.00</Text>
        <Text style={styles.description}>Booking Payment</Text>

        <TouchableOpacity
          style={styles.payButton}
          onPress={handlePayment}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.payButtonText}>Pay Now</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  backButton: { marginRight: 16 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  icon: { marginBottom: 20 },
  amount: { fontSize: 40, fontWeight: 'bold', marginBottom: 10 },
  description: { fontSize: 16, color: '#666', marginBottom: 40 },
  payButton: { backgroundColor: '#007AFF', paddingHorizontal: 40, paddingVertical: 15, borderRadius: 25, width: '100%', alignItems: 'center' },
  payButtonText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' }
});

export default PaymentScreen;
