import React, { useEffect, useState } from "react";
import { LogBox } from "react-native";

// Init i18n before other imports that might use translations
import './src/i18n';

// ── Silence non-blocking warnings that clutter the console ───────────────────
LogBox.ignoreLogs([
  // React Native / Expo Go native module warnings
  'new NativeEventEmitter',
  'EventEmitter.removeListener',
  'componentWillReceiveProps',
  'componentWillMount',
  'VirtualizedLists should never be nested',
  'Each child in a list should have a unique',
  'Warning: Cannot update a component',
  'Warning: Can\'t perform a React state update',
  // Maps / Video / Push in Expo Go
  'ExpoModulesCore',
  'react-native-maps',
  '[expo-notifications]',
  'No native splash screen',
  'Require cycle:',
]);
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import * as SplashScreen from "expo-splash-screen";
import * as Font from "expo-font";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { View } from "react-native";
import AppNavigator from "./src/navigation/AppNavigator";
import { EmergencyFAB } from "./src/components/EmergencyFAB";
import { AuthProvider } from "./src/context/AuthContext";
import { OfflineProvider } from "./src/context/OfflineContext";
import { NotificationProvider } from "./src/context/NotificationContext";
import { AccessibilityProvider } from "./src/context/AccessibilityContext";
import { ThemeProvider } from "./src/context/ThemeContext";
import ErrorBoundary from "./src/components/ErrorBoundary";
import { navigationRef } from "./src/navigation/RootNavigation";

// Keep splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(() => {
  /* reloading the app might cause this error. */
});

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Restore saved language before first render
        const { getStoredLanguage } = await import('./src/i18n');
        const saved = await getStoredLanguage();
        const i18n = (await import('./src/i18n')).default;
        await i18n.changeLanguage(saved);
        // Pre-load fonts, make any API calls you need to do here
        await Font.loadAsync({
          // Add any custom fonts here if needed
        });
        // Artificially delay for for aesthetic purposes
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (e) {
        console.warn(e);
      } finally {
        // Tell the application to render
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  useEffect(() => {
    if (appIsReady) {
      SplashScreen.hideAsync().catch((err) => {
        console.warn("App: Failed to hide splash screen:", err);
      });
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <OfflineProvider>
            <AuthProvider>
              <NotificationProvider>
                <AccessibilityProvider>
                  <ThemeProvider>
                    <NavigationContainer ref={navigationRef}>
                      <View style={{ flex: 1 }}>
                        <AppNavigator />
                        <EmergencyFAB />
                      </View>
                      <StatusBar style="auto" />
                    </NavigationContainer>
                  </ThemeProvider>
                </AccessibilityProvider>
              </NotificationProvider>
            </AuthProvider>
          </OfflineProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}