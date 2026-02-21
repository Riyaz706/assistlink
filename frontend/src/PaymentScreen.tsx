import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { api } from './api/client';

// Razorpay SDK (native) - only available in dev/production builds, not Expo Go
let RazorpayCheckout: typeof import('react-native-razorpay') | null = null;
try {
  RazorpayCheckout = require('react-native-razorpay').default;
} catch {
  // Expo Go or environment without native Razorpay
}

const PaymentScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = route.params || {};
  const bookingId = params.bookingId ?? params.appointment?.id;
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const amountRupees = 50;

  const handlePayment = async () => {
    if (!bookingId) {
      Alert.alert("Error", "Booking not found. Please go back and try again.");
      return;
    }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    try {
      console.log("[PaymentScreen] Initiating payment for booking:", bookingId);

      const order = await api.createPaymentOrder({
        booking_id: bookingId,
        amount: amountRupees,
        currency: 'INR'
      });

      console.log("[PaymentScreen] Order created:", order);

      // Bypass / already completed (backend returns key_id bypass or captured)
      if (order.key_id === 'bypass' || order.key_id === 'completed' || order.key_id === 'captured' || (order.order_id && (order.order_id.startsWith('completed_') || order.order_id.startsWith('captured_') || order.order_id.startsWith('bypass_')))) {
        console.log("[PaymentScreen] Payment bypassed or already completed by backend");
        Alert.alert("Success", "Payment confirmed. Booking is confirmed and chat is enabled.", [
          { text: "OK", onPress: () => navigation.navigate("BookingsScreen") }
        ]);
        return;
      }

      // Real Razorpay flow when SDK is available and we have a real key
      if (RazorpayCheckout && order.key_id && order.order_id) {
        const amountPaise = Math.round((order.amount || amountRupees) * 100);
        const options: Record<string, string | number> = {
          description: 'AssistLink Booking Payment',
          currency: order.currency || 'INR',
          key: order.key_id,
          amount: amountPaise,
          order_id: order.order_id,
          name: 'AssistLink',
        };
        if (Platform.OS === 'android') {
          (options as any).theme = { color: '#007AFF' };
        }
        RazorpayCheckout.open(options)
          .then((data: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
            return api.verifyPayment({
              razorpay_order_id: data.razorpay_order_id,
              razorpay_payment_id: data.razorpay_payment_id,
              razorpay_signature: data.razorpay_signature,
            });
          })
          .then(() => {
            Alert.alert("Success", "Payment Successful and Booking Confirmed!", [
              { text: "OK", onPress: () => navigation.navigate("BookingsScreen") }
            ]);
          })
          .catch((err: any) => {
            if (err?.code !== 2) {
              // 2 = user cancelled
              Alert.alert("Error", err?.description || err?.message || "Payment Failed");
            }
          })
          .finally(() => setLoading(false));
        return;
      }

      // No Razorpay SDK (e.g. Expo Go or web): cannot complete real payment
      Alert.alert(
        "Complete payment in app",
        "To pay with Razorpay, open this booking in a development or production build of the app (not Expo Go). You can also use a backend with bypass mode for testing.",
        [
          { text: "OK", onPress: () => navigation.goBack() },
        ]
      );
    } catch (error: any) {
      console.error("[PaymentScreen] Payment error:", error);
      const msg = error?.message || (typeof error?.details === 'string' ? error.details : undefined) || "Payment failed. Please try again.";
      Alert.alert("Payment error", msg);
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  const canPay = Boolean(bookingId);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment</Text>
      </View>

      <View style={styles.content}>
        <Ionicons name="card-outline" size={80} color="#007AFF" style={styles.icon} />
        <Text style={styles.amount}>₹{amountRupees}.00</Text>
        <Text style={styles.description}>Booking Payment</Text>
        {!canPay && (
          <Text style={styles.errorText}>Booking not found. Go back and open payment from a booking.</Text>
        )}
        <TouchableOpacity
          style={[styles.payButton, !canPay && styles.payButtonDisabled]}
          onPress={handlePayment}
          disabled={loading || !canPay}
          accessibilityLabel={loading ? 'Processing payment' : 'Pay now'}
          accessibilityRole="button"
          accessibilityState={{ disabled: loading || !canPay }}
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
  backButton: { minWidth: 48, minHeight: 48, justifyContent: 'center', marginRight: 16 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  icon: { marginBottom: 20 },
  amount: { fontSize: 40, fontWeight: 'bold', marginBottom: 10 },
  description: { fontSize: 16, color: '#666', marginBottom: 40 },
  payButton: { backgroundColor: '#007AFF', paddingHorizontal: 40, paddingVertical: 15, borderRadius: 25, width: '100%', alignItems: 'center' },
  payButtonDisabled: { backgroundColor: '#999', opacity: 0.8 },
  payButtonText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  errorText: { color: '#DC2626', fontSize: 14, textAlign: 'center', marginBottom: 16 },
});

export default PaymentScreen;
