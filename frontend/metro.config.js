// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// CRITICAL: Replace react-native-maps with mock BEFORE it can load
// This prevents setCustomSourceTransformer error in Expo Go
// react-native-maps requires native builds and doesn't work in Expo Go
const mockMapsPath = path.resolve(__dirname, 'src/mocks/react-native-maps.web.js');

// Note: We're patching resolveAssetSource in the mock file itself and via polyfill
// This is more reliable than using a custom transformer

// Add alias FIRST (this takes precedence over everything)
config.resolver.alias = {
  ...(config.resolver.alias || {}),
  'react-native-maps': mockMapsPath,
  'react-native-maps/lib/index.js': mockMapsPath,
  'react-native-maps/lib/MapView': mockMapsPath,
  'react-native-maps/lib/MapMarker': mockMapsPath,
  'react-native-maps/lib/MapViewNativeComponent': mockMapsPath,
  'react-native-maps/lib/MapMarkerNativeComponent': mockMapsPath,
};

// Block react-native-maps native components (but allow alias to resolve the main module)
const existingBlockList = config.resolver.blockList || [];
config.resolver.blockList = [
  ...(Array.isArray(existingBlockList) ? existingBlockList : []),
  // Block native components that require native modules
  /node_modules[\/\\]react-native-maps[\/\\]lib[\/\\].*NativeComponent/,
  /react-native-maps[\/\\]lib[\/\\].*NativeComponent/,
];

// Configure resolveRequest to ALWAYS return mock for react-native-maps
const defaultResolver = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // ALWAYS replace react-native-maps and ALL its submodules with mock
  // Check both the module name and the actual file path
  const isMapsModule = 
    moduleName === 'react-native-maps' || 
    moduleName.startsWith('react-native-maps/') ||
    moduleName.includes('react-native-maps/lib/') ||
    moduleName.includes('react-native-maps/lib') ||
    (context.originModulePath && context.originModulePath.includes('react-native-maps'));
  
  if (isMapsModule) {
    // Return mock instead of real package
    return {
      type: 'sourceFile',
      filePath: mockMapsPath,
    };
  }
  
  // Use default resolution for everything else
  if (defaultResolver) {
    return defaultResolver(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
