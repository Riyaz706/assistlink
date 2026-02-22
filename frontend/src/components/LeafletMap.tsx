import React, { useRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

const LEAFLET_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="" />
  <style>
    * { margin: 0; padding: 0; }
    html, body, #map { width: 100%; height: 100%; }
    .leaflet-container { font: 12px/1.5 "Helvetica Neue", Arial, sans-serif; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
  <script>
    var map = L.map('map').setView([17.3850, 78.4867], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    var markersLayer = L.layerGroup().addTo(map);
    var polylineLayer = null;
    function updateMap(data) {
      if (!data) return;
      markersLayer.clearLayers();
      if (polylineLayer) map.removeLayer(polylineLayer);
      if (data.center && data.zoom != null) {
        map.setView([data.center.lat, data.center.lng], data.zoom);
      }
      if (data.markers && data.markers.length) {
        data.markers.forEach(function(m) {
          var marker = L.marker([m.lat, m.lng]);
          if (m.label) marker.bindPopup(m.label);
          markersLayer.addLayer(marker);
        });
      }
      if (data.polyline && data.polyline.length >= 2) {
        var latlngs = data.polyline.map(function(p) { return [p.lat, p.lng]; });
        polylineLayer = L.polyline(latlngs, { color: '#059669', weight: 4 }).addTo(map);
        map.fitBounds(polylineLayer.getBounds(), { padding: [40, 40] });
      }
    }
    function onMapClick(e) {
      if (window.ReactNativeWebView && e.latlng) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'mapClick',
          lat: e.latlng.lat,
          lng: e.latlng.lng
        }));
      }
    }
    map.on('click', onMapClick);
    window.updateLeafletMap = updateMap;
  </script>
</body>
</html>
`;

export interface LeafletMarker {
  id: string;
  lat: number;
  lng: number;
  label?: string;
}

export interface LeafletMapProps {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: LeafletMarker[];
  polyline?: Array<{ lat: number; lng: number }>;
  onMapPress?: (lat: number, lng: number) => void;
  style?: object;
}

export default function LeafletMap({
  center,
  zoom = 14,
  markers = [],
  polyline,
  onMapPress,
  style,
}: LeafletMapProps) {
  const webRef = useRef<WebView>(null);
  const loadedRef = useRef(false);

  const injectUpdate = () => {
    const data = {
      center: { lat: center.lat, lng: center.lng },
      zoom,
      markers: markers.map((m) => ({ id: m.id, lat: m.lat, lng: m.lng, label: m.label })),
      polyline: polyline && polyline.length >= 2 ? polyline : undefined,
    };
    const script = `if (window.updateLeafletMap) window.updateLeafletMap(${JSON.stringify(data)}); true;`;
    webRef.current?.injectJavaScript(script);
  };

  useEffect(() => {
    if (loadedRef.current) injectUpdate();
  }, [center.lat, center.lng, zoom, JSON.stringify(markers), polyline ? JSON.stringify(polyline) : null]);

  const handleMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'mapClick' && typeof msg.lat === 'number' && typeof msg.lng === 'number' && onMapPress) {
        onMapPress(msg.lat, msg.lng);
      }
    } catch (_) {}
  };

  const handleLoadEnd = () => {
    loadedRef.current = true;
    injectUpdate();
  };

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webRef}
        source={{ html: LEAFLET_HTML }}
        originWhitelist={['*']}
        style={styles.webview}
        scrollEnabled={false}
        onMessage={handleMessage}
        onLoadEnd={handleLoadEnd}
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 200 },
  webview: { flex: 1, backgroundColor: '#e4e4e4' },
});
