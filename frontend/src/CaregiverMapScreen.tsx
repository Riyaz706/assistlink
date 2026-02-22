import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator, Platform, TouchableOpacity, Linking, Animated } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import BottomNav from './BottomNav';
import LeafletMap from './components/LeafletMap';

// Conditional imports for native modules (not available on web)
let Location: any = null;

// Import expo-location (works on native platforms)
if (Platform.OS !== 'web') {
  try {
    Location = require('expo-location');
  } catch (e) {
    console.warn('expo-location not available:', e);
  }
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

import { useErrorHandler, ErrorDetails } from './hooks/useErrorHandler';

const ErrorBanner = ({
  error,
  onDismiss,
  onAction,
  actionLabel
}: {
  error: ErrorDetails | null,
  onDismiss: () => void,
  onAction?: () => void,
  actionLabel?: string
}) => {
  if (!error) return null;
  return (
    <View style={styles.errorBanner}>
      <Icon name="alert-circle" size={20} color="#FFF" />
      <Text style={styles.errorText}>{error.message}</Text>
      {onAction && actionLabel && (
        <TouchableOpacity onPress={onAction} style={styles.errorActionBtn}>
          <Text style={styles.errorActionText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity onPress={onDismiss} style={styles.errorCloseBtn}>
        <Icon name="close" size={20} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
};

// ... (existing imports)

// ...

export default function CaregiverMapScreen({ route, navigation }: CaregiverMapScreenProps) {
  const insets = useSafeAreaInsets();
  const { handleError, error, clearError } = useErrorHandler();

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
  // locationError removed - using useErrorHandler

  // State for route data
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  // routeError removed - using useErrorHandler

  // State for location watch subscription
  const locationSubscriptionRef = useRef<any>(null);

  // State for map region
  const [mapRegion, setMapRegion] = useState({
    latitude: recipientLocation.latitude,
    longitude: recipientLocation.longitude,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });


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
      clearError();
      // Check if location services are enabled
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        handleError(new Error('Location services are disabled. Please enable GPS.'), 'location');
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
        handleError(new Error('Location permission denied. Cannot track your location.'), 'permission');
        setLocationPermission(false);
        return;
      }

      setLocationPermission(true);
      await getCurrentLocation();
      startLocationUpdates();
    } catch (error: any) {
      console.error('[CaregiverMapScreen] Error requesting location permission:', error);
      handleError(error, 'location-permission');
      setLocationPermission(false);
    }
  };

  const handleOpenSettings = () => {
    Linking.openSettings();
    clearError();
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
      // setLocationError(null); // removed

      // Update map region to show both locations
      updateMapRegion(newLocation, recipientLocation);

      // Calculate route when we have caregiver location
      if (caregiverLocation === null) {
        // First time getting location, calculate route
        calculateRoute(newLocation, recipientLocation);
      }
    } catch (error: any) {
      console.error('[CaregiverMapScreen] Error getting current location:', error);
      handleError(error, 'location-current');
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
        // setLocationError(null); // removed
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
  };

  // Calculate route using FREE OSRM public API
  const calculateRoute = async (
    from: { latitude: number; longitude: number },
    to: { latitude: number; longitude: number }
  ) => {
    if (!from || !to) return;

    setRouteLoading(true);
    // setRouteError(null); // removed - handled by clearError or implicit overlap

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

      // setRouteError(null); // removed
      console.log('[CaregiverMapScreen] Route calculated:', { distance, duration, points: coordinates.length });
    } catch (error: any) {
      console.error('[CaregiverMapScreen] Error calculating route:', error);
      handleError(error, 'route-calculation');
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
    if (caregiverLocation) {
      setMapRegion({
        ...mapRegion,
        latitude: caregiverLocation.latitude,
        longitude: caregiverLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  // Center on recipient location
  const centerOnRecipient = () => {
    setMapRegion({
      ...mapRegion,
      latitude: recipientLocation.latitude,
      longitude: recipientLocation.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
  };

  // Open destination in external maps (works with or without caregiver location)
  const openInNavigation = () => {
    const url = Platform.select({
      ios: `maps://app?daddr=${recipientLocation.latitude},${recipientLocation.longitude}&dirflg=d`,
      android: `google.navigation:q=${recipientLocation.latitude},${recipientLocation.longitude}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${recipientLocation.latitude},${recipientLocation.longitude}`,
    });
    const fallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${recipientLocation.latitude},${recipientLocation.longitude}`;
    if (url && url !== fallbackUrl) {
      Linking.openURL(url).catch(() => Linking.openURL(fallbackUrl));
    } else {
      Linking.openURL(fallbackUrl);
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

  // Leaflet map center and zoom from region
  const leafletCenter = { lat: mapRegion.latitude, lng: mapRegion.longitude };
  const leafletZoom = Math.max(10, Math.min(18, Math.round(14 - Math.log2(mapRegion.latitudeDelta))));
  const leafletMarkers = [
    { id: 'recipient', lat: recipientLocation.latitude, lng: recipientLocation.longitude, label: `${recipientName} (Destination)` },
    ...(caregiverLocation ? [{ id: 'caregiver', lat: caregiverLocation.latitude, lng: caregiverLocation.longitude, label: `${caregiverName} (You)` }] : []),
  ];
  const leafletPolyline = routeData && routeData.coordinates.length > 0
    ? routeData.coordinates.map((c) => ({ lat: c.latitude, lng: c.longitude }))
    : undefined;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Leaflet Map (OpenStreetMap) */}
      <LeafletMap
        center={leafletCenter}
        zoom={leafletZoom}
        markers={leafletMarkers}
        polyline={leafletPolyline}
        style={styles.map}
      />

      {/* Error Messages - below top bar */}
      <View style={[styles.errorBannerWrapper, { top: insets.top + 56 }]}>
        <ErrorBanner
          error={error}
          onDismiss={clearError}
          onAction={error?.type === 'permission' ? handleOpenSettings : undefined}
          actionLabel={error?.type === 'permission' ? 'Settings' : undefined}
        />
      </View>

      {/* Top Bar: Back + Title + Live status */}
      <Animated.View
        style={[
          styles.topControls,
          {
            top: insets.top + 8,
            opacity: cardOpacityAnim,
          }
        ]}
      >
        {navigation && (
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.modernControlButton}
            activeOpacity={0.7}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Icon name="arrow-left" size={22} color="#000" />
          </TouchableOpacity>
        )}

        <View style={styles.topBarCenter}>
          <Text style={styles.topBarTitle} numberOfLines={1}>
            Track to {recipientName}
          </Text>
          <Text style={styles.topBarSubtitle}>Care recipient location</Text>
        </View>

        {isTracking ? (
          <View style={styles.trackingStatus}>
            <View style={styles.trackingDot} />
            <Text style={styles.trackingText}>Live</Text>
          </View>
        ) : (
          <View style={styles.topBarPlaceholder} />
        )}
      </Animated.View>

      {/* Map Controls (Bottom Right) */}
      <Animated.View
        style={[
          styles.mapControls,
          {
            bottom: insets.bottom + 200,
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
            top: insets.top + 120,
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

      {/* Bottom Info Card (single expandable card) */}
      <Animated.View
        style={[
          styles.modernInfoCard,
          {
            bottom: insets.bottom + 16,
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

        {!routeData && !routeLoading && !error && caregiverLocation && (
          <Text style={styles.noRouteText}>Calculating route...</Text>
        )}

        {!caregiverLocation && locationPermission && (
          <Text style={styles.noRouteText}>Getting your location...</Text>
        )}
      </Animated.View>
      <BottomNav />
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
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 1000,
  },
  topBarCenter: {
    flex: 1,
    marginHorizontal: 12,
    justifyContent: 'center',
    minWidth: 0,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.text,
  },
  topBarSubtitle: {
    fontSize: 11,
    color: THEME.subText,
    marginTop: 2,
  },
  topBarPlaceholder: {
    width: 44,
    height: 44,
  },
  errorBannerWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 2000,
  },
  unavailableTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: THEME.card,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  unavailableTitleWrap: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0,
  },
  unavailableContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  unavailableCard: {
    backgroundColor: THEME.card,
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
  unavailableHeading: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.text,
    marginTop: 16,
    textAlign: 'center',
  },
  unavailableMessage: {
    fontSize: 14,
    color: THEME.subText,
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 22,
  },
  unavailableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    marginTop: 24,
    gap: 10,
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  unavailableButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
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
    right: 16,
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
    left: 16,
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
    backgroundColor: '#EF4444',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 2000,
  },
  errorText: {
    marginLeft: 10,
    fontSize: 13,
    color: '#FFFFFF',
    flex: 1,
    fontWeight: '500',
  },
  errorActionBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  errorActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  errorCloseBtn: {
    padding: 4,
    marginLeft: 8,
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
