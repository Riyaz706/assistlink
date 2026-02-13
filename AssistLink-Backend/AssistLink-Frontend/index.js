// CRITICAL: Polyfill must load FIRST before ANY other imports or requires
// This prevents setCustomSourceTransformer error from react-native-maps
// MUST be first line - nothing before this
require('./src/polyfills/resolveAssetSource');

// Now we can safely import other modules
import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
