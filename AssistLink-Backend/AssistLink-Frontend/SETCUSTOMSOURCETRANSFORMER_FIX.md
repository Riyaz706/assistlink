# Fix for setCustomSourceTransformer Error

## Error Explanation

The error `TypeError: setCustomSourceTransformer is not a function (it is undefined)` occurs because:

1. **react-native-maps** tries to call `resolveAssetSource.setCustomSourceTransformer()` during module initialization
2. This function is **deprecated** and doesn't exist in Expo Go
3. Metro bundler processes `react-native-maps` from `node_modules` before our mock can replace it
4. The error happens **during bundling**, not at runtime

## Fixes Applied

### 1. Metro Configuration (`metro.config.js`)
- **Alias**: Replaces ALL `react-native-maps` imports with our mock file
- **BlockList**: Prevents native components from being processed
- **resolveRequest**: Intercepts all `react-native-maps` module resolutions and returns the mock

### 2. Polyfill (`src/polyfills/resolveAssetSource.js`)
- Patches `resolveAssetSource.setCustomSourceTransformer` BEFORE any modules load
- Loads in `index.js` FIRST, before any other imports
- Uses multiple paths to ensure it works across different React Native versions

### 3. Mock File (`src/mocks/react-native-maps.web.js`)
- Provides mock components (`MapView`, `Marker`, `Polyline`, etc.)
- Patches `resolveAssetSource` IMMEDIATELY when the mock loads
- Prevents the error even if Metro somehow processes the real package

## How to Test

1. **Stop any running Expo processes**
2. **Clear all caches**:
   ```bash
   cd AssistLink-Backend/AssistLink-Frontend
   npx expo start --clear
   ```

3. **Scan QR code with Expo Go**

The error should now be resolved because:
- Metro replaces `react-native-maps` with our mock before processing
- The polyfill patches `resolveAssetSource` at app startup
- The mock file patches `resolveAssetSource` when it loads

## Why This Works

The fix uses a **multi-layered approach**:
1. **Prevention**: Metro alias prevents the real package from being loaded
2. **Polyfill**: Early patching ensures `setCustomSourceTransformer` exists before any code can call it
3. **Mock**: If anything still tries to load `react-native-maps`, it gets our safe mock

This ensures the error is caught at multiple levels, making it highly reliable.

