# Fix for setCustomSourceTransformer Error in Expo Go

## Problem
The error `setCustomSourceTransformer is not a function` occurs because `react-native-maps` tries to use a deprecated API that's not available in Expo Go.

## Solution Applied

1. **Metro Config Update**: Configured Metro to replace `react-native-maps` with a mock file
2. **Polyfill**: Added a polyfill to stub the `setCustomSourceTransformer` function
3. **Mock Components**: Created fallback UI components for maps

## To Run in Expo Go

1. **Clear all caches**:
   ```bash
   npx expo start --clear
   ```

2. **If still seeing errors, try**:
   ```bash
   # Delete cache directories
   rm -rf node_modules/.cache
   rm -rf .expo
   
   # Restart
   npx expo start --clear
   ```

3. **Scan QR code** with Expo Go app

## Important Notes

- **Maps won't work in Expo Go** - They will show a fallback message instead
- This is expected since `react-native-maps` requires native code
- All other app features should work normally
- To use maps, you'll need to create a development build

