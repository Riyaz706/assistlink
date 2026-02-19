// Mock react-native-maps for Expo Go (it requires native builds and doesn't work in Expo Go)
// Note: The setCustomSourceTransformer polyfill is handled separately in src/polyfills/resolveAssetSource.js
// This mock only provides the component stubs

// Note: We're not using React.createElement in this mock to avoid availability issues
// Components using MapView should check for null and render fallback UI

// Mock MapView component - return null so components can use their fallbacks
// Components like CaregiverMapScreen have fallbacks that will render instead
const MapView = function MapView(props) {
  // Handle ref if provided (for compatibility with components that use refs)
  if (props && props.ref) {
    const refMethods = { 
      animateToRegion: function() {}, 
      fitToCoordinates: function() {},
      animateToCoordinate: function() {},
      getCamera: function() { return Promise.resolve({}); },
    };
    
    if (typeof props.ref === 'function') {
      props.ref(refMethods);
    } else if (props.ref && typeof props.ref === 'object' && 'current' in props.ref) {
      props.ref.current = refMethods;
    }
  }
  
  // Return null - components using MapView should check for null and use fallback UI
  // This avoids React.createElement issues in the mock context
  return null;
};

MapView.displayName = 'MapView';

// Mock Marker component - return null
const Marker = function Marker(props) {
  return null;
};

// Mock Polyline component  
const Polyline = function Polyline() {
  return null;
};

// Mock PROVIDER_DEFAULT
const PROVIDER_DEFAULT = undefined;

// Mock AnimatedMapView (used as Animated)
const AnimatedMapView = MapView;

// Mock MAP_TYPES
const MAP_TYPES = {
  STANDARD: 'standard',
  SATELLITE: 'satellite',
  HYBRID: 'hybrid',
  TERRAIN: 'terrain',
  MUTEDSTANDARD: 'mutedStandard',
};

// Create module exports object matching react-native-maps structure
const MapsModule = {
  default: MapView,
  MapView,
  Marker,
  Polyline,
  PROVIDER_DEFAULT,
  Animated: AnimatedMapView,
  AnimatedMapView,
  MAP_TYPES,
  // Additional exports that react-native-maps might export
  Circle: function Circle() { return null; },
  Polygon: function Polygon() { return null; },
  Heatmap: function Heatmap() { return null; },
  Overlay: function Overlay() { return null; },
  Callout: function Callout() { return null; },
  CalloutSubview: function CalloutSubview() { return null; },
  UrlTile: function UrlTile() { return null; },
  WMSTile: function WMSTile() { return null; },
  LocalTile: function LocalTile() { return null; },
};

// Export using both CommonJS and ES module style for compatibility
module.exports = MapsModule;
module.exports.default = MapView;
module.exports.MapView = MapView;
module.exports.Marker = Marker;
module.exports.Polyline = Polyline;
module.exports.PROVIDER_DEFAULT = PROVIDER_DEFAULT;
module.exports.Animated = AnimatedMapView;
module.exports.AnimatedMapView = AnimatedMapView;
module.exports.MAP_TYPES = MAP_TYPES;
