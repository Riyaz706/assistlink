// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Use real react-native-maps (Google Maps on Android) when building/running a development build.
// Set EXPO_PUBLIC_USE_REAL_MAPS=true when running with: npx expo run:android
// When unset (e.g. Expo Go), we use a mock so the app doesn't crash.
const useRealMaps = process.env.EXPO_PUBLIC_USE_REAL_MAPS === 'true';

const mockMapsPath = path.resolve(__dirname, 'src/mocks/react-native-maps.web.js');

if (!useRealMaps) {
  // Replace react-native-maps with mock for Expo Go (prevents setCustomSourceTransformer error)
  config.resolver.alias = {
    ...(config.resolver.alias || {}),
    'react-native-maps': mockMapsPath,
    'react-native-maps/lib/index.js': mockMapsPath,
    'react-native-maps/lib/MapView': mockMapsPath,
    'react-native-maps/lib/MapMarker': mockMapsPath,
    'react-native-maps/lib/MapViewNativeComponent': mockMapsPath,
    'react-native-maps/lib/MapMarkerNativeComponent': mockMapsPath,
  };

  const existingBlockList = config.resolver.blockList || [];
  config.resolver.blockList = [
    ...(Array.isArray(existingBlockList) ? existingBlockList : []),
    /node_modules[\/\\]react-native-maps[\/\\]lib[\/\\].*NativeComponent/,
    /react-native-maps[\/\\]lib[\/\\].*NativeComponent/,
  ];
}

const defaultResolver = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isMapsModule =
    moduleName === 'react-native-maps' ||
    moduleName.startsWith('react-native-maps/') ||
    moduleName.includes('react-native-maps/lib/') ||
    moduleName.includes('react-native-maps/lib') ||
    (context.originModulePath && context.originModulePath.includes('react-native-maps'));

  if (isMapsModule && !useRealMaps) {
    return { type: 'sourceFile', filePath: mockMapsPath };
  }

  if (defaultResolver) {
    return defaultResolver(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
