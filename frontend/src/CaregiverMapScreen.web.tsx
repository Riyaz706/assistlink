// Web version of CaregiverMapScreen - clear fallback with Open in Google Maps
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

const THEME = { primary: '#059669', text: '#111827', subText: '#6B7280' };

const CaregiverMapScreen = ({ route, navigation }: any) => {
  const insets = useSafeAreaInsets();
  const params = route?.params || {};
  const recipientName = params.recipientName || 'Care Recipient';
  const recipientLocation = params.recipientLocation || { latitude: 17.385, longitude: 78.4867 };

  const openInGoogleMaps = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${recipientLocation.latitude},${recipientLocation.longitude}`;
    Linking.openURL(url);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        {navigation && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Icon name="arrow-left" size={22} color="#000" />
          </TouchableOpacity>
        )}
        <View style={styles.titleWrap}>
          <Text style={styles.title}>Track to {recipientName}</Text>
          <Text style={styles.subtitle}>Care recipient location</Text>
        </View>
        <View style={styles.placeholder} />
      </View>
      <View style={styles.content}>
        <View style={styles.card}>
          <Icon name="map-marker-off" size={56} color={THEME.primary} />
          <Text style={styles.cardTitle}>Map view unavailable</Text>
          <Text style={styles.message}>
            In-app maps are available in the mobile app. Open the destination in Google Maps to get directions.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={openInGoogleMaps}
            activeOpacity={0.8}
            accessibilityLabel="Open destination in Google Maps"
            accessibilityRole="button"
          >
            <Icon name="navigation" size={22} color="#FFF" />
            <Text style={styles.primaryButtonText}>Open in Google Maps</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  titleWrap: { flex: 1, marginLeft: 12, minWidth: 0 },
  title: { fontSize: 16, fontWeight: '700', color: THEME.text },
  subtitle: { fontSize: 11, color: THEME.subText, marginTop: 2 },
  placeholder: { width: 44, height: 44 },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.text,
    marginTop: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: THEME.subText,
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 22,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    marginTop: 24,
    gap: 10,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
});

export default CaregiverMapScreen;


