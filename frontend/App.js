import React, { useEffect, useState, useCallback } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import * as SplashScreen from "expo-splash-screen";
import * as Font from "expo-font";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import AppNavigator from "./src/navigation/AppNavigator";
import { AuthProvider } from "./src/context/AuthContext";
import { OfflineProvider } from "./src/context/OfflineContext";
import { NotificationProvider } from "./src/context/NotificationContext";
import { AccessibilityProvider } from "./src/context/AccessibilityContext";
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
                  <NavigationContainer ref={navigationRef}>
                    <AppNavigator />
                    <StatusBar style="auto" />
                  </NavigationContainer>
                </AccessibilityProvider>
              </NotificationProvider>
            </AuthProvider>
          </OfflineProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}