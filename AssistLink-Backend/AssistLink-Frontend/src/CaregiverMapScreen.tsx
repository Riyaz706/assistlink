import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator, Platform, TouchableOpacity, Linking, Animated } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

// Conditional imports for native modules (not available on web)
let Location: any = null;
let MapView: any = null;
let Marker: any = null;
let Polyline: any = null;
let PROVIDER_DEFAULT: any = null;

// Import expo-location (works on native platforms)
if (Platform.OS !== 'web') {
  try {
    Location = require('expo-location');
  } catch (e) {
    console.warn('expo-location not available:', e);
  }
}

// Import react-native-maps (only works in development builds, not in Expo Go)
// Metro config will replace this with a mock in Expo Go
try {
  const Maps = require('react-native-maps');
  // Check if this is the mock (won't have native properties) or real maps
  if (Maps && Maps.MapView) {
    MapView = Maps.default || Maps.MapView || Maps;
    Marker = Maps.Marker;
    Polyline = Maps.Polyline;
    PROVIDER_DEFAULT = Maps.PROVIDER_DEFAULT;

    // Check if this is the mock: mock sets PROVIDER_DEFAULT to undefined
    // Real react-native-maps would have a PROVIDER_DEFAULT value
    if (PROVIDER_DEFAULT === undefined && MapView && typeof MapView === 'function') {
      // This is likely the mock - check if it's the mock by seeing if it's a simple function
      // The mock returns null, so we'll use the fallback instead
      MapView = null;
      Marker = null;
      Polyline = null;
      PROVIDER_DEFAULT = undefined;
    }
  }
} catch (e) {
  // If require fails, Metro should have replaced it with mock, but just in case:
  console.warn('react-native-maps not available, using fallback:', e);
}

// Web fallback components - use if MapView is null or if we detected it's the mock
if (!MapView) {
  MapView = ({ children, style, ...props }: any) => (
    <View style={[style, { backgroundColor: '#EBF4EF', justifyContent: 'center', alignItems: 'center', padding: 20, minHeight: 400 }]}>
      <Icon name="map-marker-off" size={64} color="#059669" />
      <Text style={{ color: '#1F2937', fontSize: 18, fontWeight: '600', marginTop: 16, textAlign: 'center' }}>
        Map View Unavailable
      </Text>
      <Text style={{ color: '#6B7280', fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 20, lineHeight: 20 }}>
        {Platform.OS === 'web'
          ? 'Map features are only available on mobile devices. Please use the Android app for full functionality.'
          : 'Map features require a development build and are not available in Expo Go. Please build the app using "npx expo run:android" to enable map features.'}
      </Text>
      {children}
    </View>
  );
  Marker = ({ children }: any) => <View>{children}</View>;
  Polyline = () => null;
  PROVIDER_DEFAULT = undefined;
}

// Location fallback
if (!Location) {
  Location = {
    hasServicesEnabledAsync: async () => false,
    requestForegroundPermissionsAsync: async () => ({ status: 'denied' }),
    getCurrentPositionAsync: async () => ({ coords: { latitude: 0, longitude: 0 } }),
    watchPositionAsync: () => ({ remove: () => { } }),
    Accuracy: { Balanced: 0 }
  };
}

const THEME = {
  primary: "#059669",
  primaryLight: "#10B981",
  primaryDark: "#047857",
  bg: "#F9FAFB",
  card: "#FFFFFF",
  cardGlass: "rgba(255, 255, 255, 0.95)",
  text: "#111827",
  subText: "#4B5563",
  error: "#DC2626",
  success: "#10B981",
  warning: "#F59E0B",
  gradient: ["#059669", "#10B981"],
};

interface RouteData {
  distance: number; // in meters
  duration: number; // in seconds
  coordinates: Array<{ latitude: number; longitude: number }>;
}

interface CaregiverMapScreenProps {
  route?: {
    params?: {
      recipientLocation?: { latitude: number; longitude: number };
      recipientName?: string;
      caregiverName?: string;
    };
  };
  navigation?: any;
}

export default function CaregiverMapScreen({ route, navigation }: CaregiverMapScreenProps) {
  const insets = useSafeAreaInsets();
  // Mock recipient location (can be passed via route params)
  const recipientLocation = route?.params?.recipientLocation || {
    latitude: 17.3850, // Hyderabad coordinates
    longitude: 78.4867,
  };

  const recipientName = route?.params?.recipientName || 'Care Recipient';
  const caregiverName = route?.params?.caregiverName || 'Caregiver';

  // State for caregiver location (device GPS)
  const [caregiverLocation, setCaregiverLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  // State for location permission
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // State for route data
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  // State for location watch subscription
  const locationSubscriptionRef = useRef<any>(null);

  // State for map region
  const [mapRegion, setMapRegion] = useState({
    latitude: recipientLocation.latitude,
    longitude: recipientLocation.longitude,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  // Map reference
  const mapRef = useRef<any>(null);

  // New UI states
  const [mapType, setMapType] = useState<'standard' | 'satellite' | 'hybrid'>('standard');
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState<number | null>(null);
  const [isTracking, setIsTracking] = useState(true);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const cardOpacityAnim = useRef(new Animated.Value(1)).current;

  // Request location permission and get initial location
  useEffect(() => {
    requestLocationPermission();

    return () => {
      // Cleanup: Stop watching location when component unmounts
      if (locationSubscriptionRef.current && locationSubscriptionRef.current.remove) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }
    };
  }, []);

  // Handle screen focus - reset layout when coming back from other tabs
  useFocusEffect(
    React.useCallback(() => {
      // Reset any layout issues when screen comes into focus
      // This ensures UI elements are properly positioned
      return () => {
        // Cleanup if needed
      };
    }, [])
  );

  // Request location permission
  const requestLocationPermission = async () => {
    try {
      // Check if location services are enabled
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setLocationError('Location services are disabled. Please enable GPS.');
        Alert.alert(
          'Location Services Disabled',
          'Please enable location services in your device settings.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Request foreground location permission
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        setLocationError('Location permission denied. Cannot track your location.');
        setLocationPermission(false);
        Alert.alert(
          'Permission Denied',
          'Location permission is required to show your position on the map.',
          [{ text: 'OK' }]
        );
        return;
      }

      setLocationPermission(true);
      setLocationError(null);

      // Get initial location
      await getCurrentLocation();

      // Start watching location for live updates
      startLocationUpdates();
    } catch (error: any) {
      console.error('[CaregiverMapScreen] Error requesting location permission:', error);
      setLocationError('Failed to request location permission.');
      setLocationPermission(false);
    }
  };

  // Get current location once
  const getCurrentLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced, // Balance between accuracy and battery
      });

      const newLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setCaregiverLocation(newLocation);
      setLocationError(null);

      // Update map region to show both locations
      updateMapRegion(newLocation, recipientLocation);

      // Calculate route when we have caregiver location
      if (caregiverLocation === null) {
        // First time getting location, calculate route
        calculateRoute(newLocation, recipientLocation);
      }
    } catch (error: any) {
      console.error('[CaregiverMapScreen] Error getting current location:', error);
      setLocationError('Failed to get your current location.');
    }
  };

  // Start watching location for live updates (every 5-10 seconds)
  const startLocationUpdates = () => {
    if (locationSubscriptionRef.current) {
      // Already watching, don't start again
      return;
    }

    // Watch position with 5-10 second interval
    // Note: watchPositionAsync uses less battery than getCurrentPositionAsync in a loop
    locationSubscriptionRef.current = Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 8000, // Update every 8 seconds (balance between real-time and battery)
        distanceInterval: 50, // Update if moved at least 50 meters
      },
      (location: any) => {
        const newLocation = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };

        setCaregiverLocation(newLocation);
        setLocationError(null);
        setLastUpdateTime(new Date());

        // Update speed if available
        if (location.coords.speed !== null && location.coords.speed !== undefined) {
          // Convert m/s to km/h
          setCurrentSpeed(location.coords.speed * 3.6);
        }

        // Update map region
        updateMapRegion(newLocation, recipientLocation);

        // Recalculate route when location updates
        calculateRoute(newLocation, recipientLocation);
      }
    );
  };

  // Update map region to show both caregiver and recipient
  const updateMapRegion = (
    caregiver: { latitude: number; longitude: number },
    recipient: { latitude: number; longitude: number }
  ) => {
    // Calculate bounds to include both points
    const minLat = Math.min(caregiver.latitude, recipient.latitude);
    const maxLat = Math.max(caregiver.latitude, recipient.latitude);
    const minLng = Math.min(caregiver.longitude, recipient.longitude);
    const maxLng = Math.max(caregiver.longitude, recipient.longitude);

    const latDelta = (maxLat - minLat) * 1.5; // Add 50% padding
    const lngDelta = (maxLng - minLng) * 1.5;

    const newRegion = {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(latDelta, 0.01), // Minimum zoom level
      longitudeDelta: Math.max(lngDelta, 0.01),
    };

    setMapRegion(newRegion);

    // Animate map to new region
    if (mapRef.current && mapRef.current.animateToRegion) {
      mapRef.current.animateToRegion(newRegion, 1000);
    }
  };

  // Calculate route using FREE OSRM public API
  const calculateRoute = async (
    from: { latitude: number; longitude: number },
    to: { latitude: number; longitude: number }
  ) => {
    if (!from || !to) return;

    setRouteLoading(true);
    setRouteError(null);

    try {
      // OSRM API endpoint (FREE, no API key required)
      // Format: /route/v1/{profile}/{coordinates}?overview=full&geometries=geojson
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=geojson`;

      console.log('[CaregiverMapScreen] Calculating route via OSRM:', osrmUrl);

      const response = await fetch(osrmUrl);

      if (!response.ok) {
        throw new Error(`OSRM API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        throw new Error('No route found');
      }

      const route = data.routes[0];

      // Extract distance (in meters) and duration (in seconds)
      const distance = route.distance; // meters
      const duration = route.duration; // seconds

      // Extract route geometry (GeoJSON format)
      const geometry = route.geometry;

      // Convert GeoJSON coordinates to {latitude, longitude} array
      const coordinates: Array<{ latitude: number; longitude: number }> = [];
      if (geometry.type === 'LineString' && geometry.coordinates) {
        geometry.coordinates.forEach((coord: [number, number]) => {
          // GeoJSON format: [longitude, latitude]
          coordinates.push({
            longitude: coord[0],
            latitude: coord[1],
          });
        });
      }

      setRouteData({
        distance,
        duration,
        coordinates,
      });

      setRouteError(null);
      console.log('[CaregiverMapScreen] Route calculated:', { distance, duration, points: coordinates.length });
    } catch (error: any) {
      console.error('[CaregiverMapScreen] Error calculating route:', error);
      setRouteError('Failed to calculate route. Please check your internet connection.');
      setRouteData(null);
    } finally {
      setRouteLoading(false);
    }
  };

  // Calculate proximity status based on distance
  const getProximityStatus = (distanceMeters: number): string => {
    if (distanceMeters < 50) {
      return 'Caregiver Arrived';
    } else if (distanceMeters < 200) {
      return 'Arriving Soon';
    } else {
      return 'On the Way';
    }
  };

  // Format distance for display
  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    } else {
      return `${(meters / 1000).toFixed(1)} km`;
    }
  };

  // Format duration for display
  const formatDuration = (seconds: number): string => {
    const minutes = Math.round(seconds / 60);
    if (minutes < 1) {
      return '< 1 min';
    } else if (minutes < 60) {
      return `${minutes} min`;
    } else {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}h ${mins}m`;
    }
  };

  // Toggle map type
  const toggleMapType = () => {
    const types: Array<'standard' | 'satellite' | 'hybrid'> = ['standard', 'satellite', 'hybrid'];
    const currentIndex = types.indexOf(mapType);
    const nextIndex = (currentIndex + 1) % types.length;
    setMapType(types[nextIndex]);
  };

  // Center map on both locations
  const recenterMap = () => {
    if (caregiverLocation) {
      updateMapRegion(caregiverLocation, recipientLocation);
    }
  };

  // Center on caregiver location
  const centerOnCaregiver = () => {
    if (caregiverLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        ...mapRegion,
        latitude: caregiverLocation.latitude,
        longitude: caregiverLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    }
  };

  // Center on recipient location
  const centerOnRecipient = () => {
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        ...mapRegion,
        latitude: recipientLocation.latitude,
        longitude: recipientLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    }
  };

  // Open in external navigation app
  const openInNavigation = () => {
    if (caregiverLocation && recipientLocation) {
      const url = Platform.select({
        ios: `maps://app?daddr=${recipientLocation.latitude},${recipientLocation.longitude}&dirflg=d`,
        android: `google.navigation:q=${recipientLocation.latitude},${recipientLocation.longitude}`,
      });

      if (url) {
        Linking.openURL(url).catch(() => {
          // Fallback to Google Maps web
          Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${recipientLocation.latitude},${recipientLocation.longitude}`);
        });
      }
    }
  };

  // Share location
  const shareLocation = () => {
    if (caregiverLocation) {
      const url = `https://www.google.com/maps?q=${caregiverLocation.latitude},${caregiverLocation.longitude}`;
      const message = `My current location: ${url}`;

      if (Platform.OS === 'ios') {
        Linking.openURL(`sms:&body=${encodeURIComponent(message)}`);
      } else {
        Linking.openURL(`sms:?body=${encodeURIComponent(message)}`);
      }
    }
  };

  // Call recipient (placeholder - would need phone number from route params)
  const callRecipient = () => {
    Alert.alert('Call', `Would call ${recipientName}`, [{ text: 'OK' }]);
  };

  // Toggle info card expansion
  const toggleInfoExpansion = () => {
    setIsInfoExpanded(!isInfoExpanded);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: isInfoExpanded ? 0 : 1,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(cardOpacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start();
  };

  // Calculate progress percentage (0-100)
  const getProgressPercentage = (): number => {
    if (!routeData || !caregiverLocation) return 0;
    // Simple progress based on distance remaining
    // In a real app, you'd calculate actual progress along the route
    const maxDistance = 10000; // 10km max for progress calculation
    return Math.min(100, Math.max(0, ((maxDistance - routeData.distance) / maxDistance) * 100));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Map View */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={mapRegion}
        showsUserLocation={false} // We'll use custom markers
        showsMyLocationButton={false}
        mapType={mapType}
        mapPadding={{
          top: insets.top + 10,
          right: 0,
          bottom: insets.bottom + 80,
          left: 0,
        }}
      >
        {/* Recipient Marker (Fixed Location) */}
        <Marker
          coordinate={recipientLocation}
          title={recipientName}
          description="Care Recipient Location"
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={styles.recipientMarkerContainer}>
            <View style={styles.recipientMarkerShadow} />
            <View style={styles.recipientMarker}>
              <Icon name="map-marker" size={24} color="#FFFFFF" />
            </View>
            <View style={styles.markerLabel}>
              <Text style={styles.markerLabelText}>{recipientName}</Text>
              <Text style={styles.markerLabelSubtext}>Destination</Text>
            </View>
          </View>
        </Marker>

        {/* Caregiver Marker (Device Location) */}
        {caregiverLocation && (
          <Marker
            coordinate={caregiverLocation}
            title={caregiverName}
            description="Caregiver Location"
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.caregiverMarkerContainer}>
              {isTracking && (
                <View style={styles.trackingPulse} />
              )}
              <View style={styles.caregiverMarkerShadow} />
              <View style={styles.caregiverMarker}>
                <Icon name="account" size={20} color="#FFFFFF" />
                {isTracking && (
                  <View style={styles.trackingIndicator}>
                    <View style={styles.trackingDotInner} />
                  </View>
                )}
              </View>
              <View style={styles.markerLabel}>
                <Text style={styles.markerLabelText}>{caregiverName}</Text>
                <Text style={styles.markerLabelSubtext}>You</Text>
              </View>
            </View>
          </Marker>
        )}

        {/* Route Polyline */}
        {routeData && routeData.coordinates.length > 0 && (
          <Polyline
            coordinates={routeData.coordinates}
            strokeColor={THEME.primary}
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
          />
        )}
      </MapView>

      {/* Error Messages */}
      {locationError && (
        <View style={styles.errorBanner}>
          <Icon name="alert-circle" size={20} color={THEME.error} />
          <Text style={styles.errorText}>{locationError}</Text>
        </View>
      )}

      {routeError && (
        <View style={styles.errorBanner}>
          <Icon name="alert-circle" size={20} color={THEME.error} />
          <Text style={styles.errorText}>{routeError}</Text>
        </View>
      )}

      {/* Bottom Info Card */}
      <View style={styles.infoCard}>
        {routeLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={THEME.primary} />
            <Text style={styles.loadingText}>Calculating route...</Text>
          </View>
        )}

        {routeData && !routeLoading && (
          <>
            {/* Distance */}
            <View style={styles.infoRow}>
              <Icon name="map-marker-distance" size={20} color={THEME.primary} />
              <Text style={styles.infoLabel}>Distance:</Text>
              <Text style={styles.infoValue}>{formatDistance(routeData.distance)}</Text>
            </View>

            {/* ETA */}
            <View style={styles.infoRow}>
              <Icon name="clock-outline" size={20} color={THEME.primary} />
              <Text style={styles.infoLabel}>ETA:</Text>
              <Text style={styles.infoValue}>{formatDuration(routeData.duration)}</Text>
            </View>

            {/* Status */}
            <View style={styles.statusRow}>
              <View style={[
                styles.statusBadge,
                routeData.distance < 50 && styles.statusBadgeArrived,
                routeData.distance >= 50 && routeData.distance < 200 && styles.statusBadgeArriving,
              ]}>
                <Text style={styles.statusText}>
                  {getProximityStatus(routeData.distance)}
                </Text>
              </View>
            </View>
          </>
        )}

        {!routeData && !routeLoading && !routeError && caregiverLocation && (
          <Text style={styles.noRouteText}>Calculating route...</Text>
        )}

        {!caregiverLocation && locationPermission && (
          <Text style={styles.noRouteText}>Getting your location...</Text>
        )}
      </View>

      {/* Top Controls */}
      <Animated.View
        style={[
          styles.topControls,
          {
            opacity: cardOpacityAnim,
          }
        ]}
      >
        {navigation && (
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.modernControlButton}
            activeOpacity={0.7}
          >
            <Icon name="arrow-left" size={22} color="#000" />
          </TouchableOpacity>
        )}

        {/* Live Tracking Status */}
        {isTracking && (
          <View style={styles.trackingStatus}>
            <View style={styles.trackingDot} />
            <Text style={styles.trackingText}>Live Tracking</Text>
          </View>
        )}
      </Animated.View>

      {/* Map Controls (Bottom Right) */}
      <Animated.View
        style={[
          styles.mapControls,
          {
            opacity: cardOpacityAnim,
          }
        ]}
      >
        <TouchableOpacity
          style={styles.modernControlButton}
          onPress={recenterMap}
          activeOpacity={0.7}
        >
          <Icon name="crosshairs-gps" size={20} color="#000" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.modernControlButton}
          onPress={centerOnCaregiver}
          disabled={!caregiverLocation}
          activeOpacity={0.7}
        >
          <Icon name="account" size={20} color={caregiverLocation ? "#000" : "#999"} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.modernControlButton}
          onPress={centerOnRecipient}
          activeOpacity={0.7}
        >
          <Icon name="map-marker" size={20} color="#DC2626" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.modernControlButton}
          onPress={toggleMapType}
          activeOpacity={0.7}
        >
          <Icon name={mapType === 'standard' ? 'satellite-variant' : mapType === 'satellite' ? 'map' : 'map-outline'} size={20} color="#000" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.modernControlButton,
            routeLoading && styles.controlButtonLoading
          ]}
          onPress={() => {
            if (caregiverLocation) {
              calculateRoute(caregiverLocation, recipientLocation);
            }
          }}
          disabled={routeLoading || !caregiverLocation}
          activeOpacity={0.7}
        >
          {routeLoading ? (
            <ActivityIndicator size="small" color={THEME.primary} />
          ) : (
            <Icon name="refresh" size={20} color={routeLoading || !caregiverLocation ? "#999" : "#000"} />
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Quick Actions (Left Side) */}
      <Animated.View
        style={[
          styles.quickActions,
          {
            opacity: cardOpacityAnim,
          }
        ]}
      >
        <TouchableOpacity
          style={[styles.modernActionButton, styles.actionButtonPrimary]}
          onPress={openInNavigation}
          disabled={!caregiverLocation}
          activeOpacity={0.8}
        >
          <Icon name="navigation" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modernActionButton, styles.actionButtonSuccess]}
          onPress={callRecipient}
          activeOpacity={0.8}
        >
          <Icon name="phone" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modernActionButton, styles.actionButtonInfo]}
          onPress={shareLocation}
          disabled={!caregiverLocation}
          activeOpacity={0.8}
        >
          <Icon name="share-variant" size={22} color="#fff" />
        </TouchableOpacity>
      </Animated.View>

      {/* Bottom Info Card */}
      <Animated.View
        style={[
          styles.modernInfoCard,
          {
            maxHeight: slideAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [110, 380],
            }),
            opacity: cardOpacityAnim,
          }
        ]}
      >
        <TouchableOpacity
          style={styles.modernInfoCardHeader}
          onPress={toggleInfoExpansion}
          activeOpacity={0.8}
        >
          <View style={styles.infoCardHeaderLeft}>
            {routeLoading ? (
              <View style={styles.iconContainer}>
                <ActivityIndicator size="small" color={THEME.primary} />
              </View>
            ) : routeData ? (
              <View style={[styles.iconContainer, styles.iconContainerPrimary]}>
                <Icon name="map-marker-distance" size={20} color="#fff" />
              </View>
            ) : (
              <View style={styles.iconContainer}>
                <Icon name="map-outline" size={20} color={THEME.subText} />
              </View>
            )}
            <View style={styles.infoCardTitleContainer}>
              {routeData && (
                <>
                  <Text style={styles.modernInfoCardTitle}>{formatDistance(routeData.distance)}</Text>
                  <View style={styles.etaContainer}>
                    <Icon name="clock-outline" size={14} color={THEME.subText} />
                    <Text style={styles.modernInfoCardSubtitle}>ETA: {formatDuration(routeData.duration)}</Text>
                  </View>
                </>
              )}
              {!routeData && !routeLoading && (
                <Text style={styles.modernInfoCardTitle}>Calculating route...</Text>
              )}
            </View>
          </View>
          <Animated.View
            style={{
              transform: [{
                rotate: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '180deg'],
                })
              }]
            }}
          >
            <Icon
              name="chevron-up"
              size={24}
              color={THEME.subText}
            />
          </Animated.View>
        </TouchableOpacity>

        {routeData && !routeLoading && (
          <>
            {/* Progress Bar */}
            <View style={styles.modernProgressContainer}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Journey Progress</Text>
                <Text style={styles.progressPercentage}>{getProgressPercentage().toFixed(0)}%</Text>
              </View>
              <View style={styles.modernProgressBar}>
                <Animated.View
                  style={[
                    styles.modernProgressFill,
                    {
                      width: slideAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', `${getProgressPercentage()}%`],
                      })
                    }
                  ]}
                />
              </View>
            </View>

            {/* Expanded Info */}
            {isInfoExpanded && (
              <Animated.View
                style={[
                  styles.modernExpandedInfo,
                  {
                    opacity: slideAnim,
                  }
                ]}
              >
                <View style={styles.modernInfoGrid}>
                  <View style={styles.modernInfoItem}>
                    <View style={[styles.modernIconContainer, styles.iconContainerPrimary]}>
                      <Icon name="map-marker-distance" size={20} color="#fff" />
                    </View>
                    <Text style={styles.modernInfoLabel}>Distance</Text>
                    <Text style={styles.modernInfoValue}>{formatDistance(routeData.distance)}</Text>
                  </View>

                  <View style={styles.modernInfoItem}>
                    <View style={[styles.modernIconContainer, styles.iconContainerWarning]}>
                      <Icon name="clock-outline" size={20} color="#fff" />
                    </View>
                    <Text style={styles.modernInfoLabel}>ETA</Text>
                    <Text style={styles.modernInfoValue}>{formatDuration(routeData.duration)}</Text>
                  </View>

                  {currentSpeed !== null && (
                    <View style={styles.modernInfoItem}>
                      <View style={[styles.modernIconContainer, styles.iconContainerSuccess]}>
                        <Icon name="speedometer" size={20} color="#fff" />
                      </View>
                      <Text style={styles.modernInfoLabel}>Speed</Text>
                      <Text style={styles.modernInfoValue}>{currentSpeed.toFixed(0)} km/h</Text>
                    </View>
                  )}

                  {lastUpdateTime && (
                    <View style={styles.modernInfoItem}>
                      <View style={[styles.modernIconContainer, styles.iconContainerInfo]}>
                        <Icon name="update" size={20} color="#fff" />
                      </View>
                      <Text style={styles.modernInfoLabel}>Last Update</Text>
                      <Text style={styles.modernInfoValue}>
                        {lastUpdateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Status Badge */}
                <View style={styles.modernStatusRow}>
                  <View style={[
                    styles.modernStatusBadge,
                    routeData.distance < 50 && styles.modernStatusBadgeArrived,
                    routeData.distance >= 50 && routeData.distance < 200 && styles.modernStatusBadgeArriving,
                  ]}>
                    <Icon
                      name={routeData.distance < 50 ? "check-circle" : routeData.distance < 200 ? "clock-alert" : "map-marker-path"}
                      size={16}
                      color="#fff"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.modernStatusText}>
                      {getProximityStatus(routeData.distance)}
                    </Text>
                  </View>
                </View>
              </Animated.View>
            )}
          </>
        )}

        {!routeData && !routeLoading && !routeError && caregiverLocation && (
          <Text style={styles.noRouteText}>Calculating route...</Text>
        )}

        {!caregiverLocation && locationPermission && (
          <Text style={styles.noRouteText}>Getting your location...</Text>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.bg,
    position: 'relative',
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  recipientMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipientMarkerShadow: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#DC2626',
    opacity: 0.2,
    top: -8,
    left: -8,
  },
  recipientMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    position: 'relative',
  },
  caregiverMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  caregiverMarkerShadow: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: THEME.primary,
    opacity: 0.2,
    top: -8,
    left: -8,
  },
  caregiverMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    position: 'relative',
  },
  markerIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackingPulse: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: THEME.primary,
    top: -8,
    left: -8,
  },
  trackingIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: THEME.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackingDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.success,
  },
  markerLabel: {
    backgroundColor: THEME.cardGlass,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    minWidth: 80,
    alignItems: 'center',
  },
  markerLabelText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.text,
    textAlign: 'center',
  },
  markerLabelSubtext: {
    fontSize: 9,
    fontWeight: '500',
    color: THEME.subText,
    textAlign: 'center',
    marginTop: 2,
  },
  topControls: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 1000,
  },
  trackingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.cardGlass,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  infoCard: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  trackingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: THEME.success,
    marginRight: 8,
    shadowColor: THEME.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  },
  trackingText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.text,
    letterSpacing: 0.5,
  },
  mapControls: {
    position: 'absolute',
    right: 20,
    bottom: 220,
    backgroundColor: THEME.cardGlass,
    borderRadius: 16,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    zIndex: 1000,
  },
  quickActions: {
    position: 'absolute',
    left: 20,
    top: '50%',
    transform: [{ translateY: -80 }],
    zIndex: 1000,
  },
  modernControlButton: {
    backgroundColor: THEME.card,
    borderRadius: 12,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  controlButtonLoading: {
    backgroundColor: '#F3F4F6',
  },
  modernActionButton: {
    borderRadius: 28,
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  actionButtonPrimary: {
    backgroundColor: THEME.primary,
  },
  actionButtonSuccess: {
    backgroundColor: THEME.success,
  },
  actionButtonInfo: {
    backgroundColor: '#3B82F6',
  },
  modernInfoCard: {
    position: 'absolute',
    bottom: 70,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    zIndex: 999,
    maxWidth: '100%',
  },
  modernInfoCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#FFFFFF',
  },
  infoCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainerPrimary: {
    backgroundColor: THEME.primary,
  },
  iconContainerWarning: {
    backgroundColor: THEME.warning,
  },
  iconContainerSuccess: {
    backgroundColor: THEME.success,
  },
  iconContainerInfo: {
    backgroundColor: '#3B82F6',
  },
  infoCardTitleContainer: {
    marginLeft: 12,
    flex: 1,
  },
  modernInfoCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.text,
    letterSpacing: -0.5,
  },
  modernInfoCardSubtitle: {
    fontSize: 12,
    color: THEME.subText,
    marginTop: 2,
  },
  etaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  modernProgressContainer: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.subText,
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.primary,
  },
  modernProgressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  modernProgressFill: {
    height: '100%',
    backgroundColor: THEME.primary,
    borderRadius: 4,
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 2,
  },
  modernExpandedInfo: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 6,
    backgroundColor: '#FFFFFF',
  },
  modernInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modernInfoItem: {
    width: '48%',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  modernIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  modernInfoLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: THEME.subText,
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modernInfoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.text,
  },
  modernStatusRow: {
    marginTop: 8,
    alignItems: 'center',
  },
  modernStatusBadge: {
    backgroundColor: THEME.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  modernStatusBadgeArrived: {
    backgroundColor: THEME.success,
    shadowColor: THEME.success,
  },
  modernStatusBadgeArriving: {
    backgroundColor: THEME.warning,
    shadowColor: THEME.warning,
  },
  modernStatusText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: THEME.subText,
    marginLeft: 8,
    marginRight: 8,
    flex: 1,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.text,
  },
  statusRow: {
    marginTop: 8,
    alignItems: 'center',
  },
  statusBadge: {
    backgroundColor: THEME.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusBadgeArrived: {
    backgroundColor: '#10B981', // Green for arrived
  },
  statusBadgeArriving: {
    backgroundColor: '#F59E0B', // Orange for arriving soon
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: THEME.subText,
  },
  noRouteText: {
    fontSize: 14,
    color: THEME.subText,
    textAlign: 'center',
    padding: 8,
  },
  errorBanner: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  errorText: {
    marginLeft: 8,
    fontSize: 12,
    color: THEME.error,
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: 20,
    left: 20,
  },
  backButtonInner: {
    backgroundColor: THEME.card,
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});
