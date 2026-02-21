import React, { useMemo, useState, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import type { MapCoordinate, CaregiverMarker } from '@/types/map';
import { MapFallback } from './MapFallback';
import { MapLoading } from './MapLoading';
import { DEFAULT_ZOOM, FALLBACK_CENTER, MAP_MIN_HEIGHT_PX } from './constants';

const containerStyle: React.CSSProperties = {
  width: '100%',
  minHeight: `${MAP_MIN_HEIGHT_PX}px`,
  borderRadius: '0.5rem',
  border: '1px solid #e5e7eb',
};

const defaultMapOptions: google.maps.MapOptions = {
  zoomControl: true,
  mapTypeControl: true,
  fullscreenControl: true,
  streetViewControl: false,
  rotateControl: false,
  gestureHandling: 'cooperative',
  disableDefaultUI: false,
  minZoom: 10,
  maxZoom: 18,
};

export interface AssistLinkMapViewProps {
  apiKey: string | undefined;
  userPosition: MapCoordinate | null;
  caregivers: CaregiverMarker[];
  defaultCenter?: MapCoordinate;
  defaultZoom?: number;
  highlightPosition?: MapCoordinate | null;
  mode?: 'default' | 'emergency';
  ariaLabel?: string;
  className?: string;
}

/**
 * Production-ready VIEW-ONLY map. No business logic.
 * If the map fails, the app must continue to work.
 */
export function AssistLinkMapView({
  apiKey,
  userPosition,
  caregivers,
  defaultCenter,
  defaultZoom = DEFAULT_ZOOM,
  highlightPosition,
  mode = 'default',
  ariaLabel = 'Map showing locations',
  className = '',
}: AssistLinkMapViewProps) {
  const [infoMarkerId, setInfoMarkerId] = useState<string | null>(null);

  const { isLoaded, loadError: loaderError } = useJsApiLoader({
    id: 'assistlink-google-map',
    googleMapsApiKey: apiKey ?? '',
    preventGoogleFontsLoading: true,
  });

  const effectiveError = loaderError ?? null;

  const center = useMemo(() => {
    if (userPosition) return { lat: userPosition.lat, lng: userPosition.lng };
    if (highlightPosition) return { lat: highlightPosition.lat, lng: highlightPosition.lng };
    if (caregivers.length > 0) {
      const c = caregivers[0].position;
      return { lat: c.lat, lng: c.lng };
    }
    return defaultCenter
      ? { lat: defaultCenter.lat, lng: defaultCenter.lng }
      : { lat: FALLBACK_CENTER.lat, lng: FALLBACK_CENTER.lng };
  }, [userPosition, highlightPosition, caregivers, defaultCenter]);

  const bounds = useMemo(() => {
    const points: MapCoordinate[] = [];
    if (userPosition) points.push(userPosition);
    if (highlightPosition) points.push(highlightPosition);
    caregivers.forEach((m) => points.push(m.position));
    if (points.length < 2) return null;
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    return {
      north: Math.max(...lats),
      south: Math.min(...lats),
      east: Math.max(...lngs),
      west: Math.min(...lngs),
    };
  }, [userPosition, highlightPosition, caregivers]);

  const onLoad = useCallback((map: google.maps.Map) => {
    if (bounds) {
      const b = new google.maps.LatLngBounds(
        { lat: bounds.south, lng: bounds.west },
        { lat: bounds.north, lng: bounds.east }
      );
      map.fitBounds(b, { top: 48, right: 48, bottom: 48, left: 48 });
    }
  }, [bounds]);

  const openInfo = useCallback((id: string) => setInfoMarkerId(id), []);
  const closeInfo = useCallback(() => setInfoMarkerId(null), []);

  if (!apiKey || apiKey.trim() === '') {
    return (
      <MapFallback
        role="status"
        title="Map unavailable"
        message="Map is not configured. You can still use all other features."
        className={className}
      />
    );
  }

  if (effectiveError) {
    return (
      <MapFallback
        role="alert"
        title="Map could not be loaded"
        message="You can continue without the map. Try again later or use the list view."
        className={className}
      />
    );
  }

  if (!isLoaded) {
    return <MapLoading className={className} />;
  }

  const isEmergency = mode === 'emergency';

  return (
    <div
      className={className}
      role="application"
      aria-label={ariaLabel}
      style={{ minHeight: MAP_MIN_HEIGHT_PX }}
    >
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={defaultZoom}
        options={{
          ...defaultMapOptions,
          styles: isEmergency
            ? [
                { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
                { featureType: 'transit', stylers: [{ visibility: 'off' }] },
              ]
            : undefined,
        }}
        onLoad={bounds ? onLoad : undefined}
      >
        {userPosition && (
          <Marker
            position={{ lat: userPosition.lat, lng: userPosition.lng }}
            title="Your location"
            label={{ text: 'You', color: '#fff', fontWeight: 'bold' }}
            zIndex={100}
            clickable
            onClick={() => openInfo('user')}
          />
        )}

        {highlightPosition && !userPosition && (
          <Marker
            position={{ lat: highlightPosition.lat, lng: highlightPosition.lng }}
            title="Location"
            label={{ text: '★', color: '#fff' }}
            zIndex={90}
          />
        )}

        {caregivers.map((m) => (
          <Marker
            key={m.id}
            position={{ lat: m.position.lat, lng: m.position.lng }}
            title={m.label}
            label={{ text: m.label.charAt(0).toUpperCase(), color: '#fff' }}
            zIndex={50}
            clickable
            onClick={() => openInfo(m.id)}
          />
        ))}

        {infoMarkerId === 'user' && userPosition && (
          <InfoWindow
            position={{ lat: userPosition.lat, lng: userPosition.lng }}
            onCloseClick={closeInfo}
          >
            <div className="p-1 text-sm">
              <p className="font-semibold">Your location</p>
              <p className="text-gray-600">This is where you are on the map.</p>
            </div>
          </InfoWindow>
        )}

        {caregivers.map(
          (m) =>
            infoMarkerId === m.id && (
              <InfoWindow
                key={m.id}
                position={{ lat: m.position.lat, lng: m.position.lng }}
                onCloseClick={closeInfo}
              >
                <div className="min-w-[160px] p-1 text-sm">
                  <p className="font-semibold">{m.label}</p>
                  {m.subtitle && <p className="text-gray-600">{m.subtitle}</p>}
                  {m.description && <p className="mt-1 text-gray-500">{m.description}</p>}
                </div>
              </InfoWindow>
            )
        )}
      </GoogleMap>
    </div>
  );
}
