Sentry.init({
  dsn: "https://examplePublicKey@o0.ingest.sentry.io/0", // Replace with real DSN
  debug: __DEV__,
  enabled: !__DEV__, // Only enable in production or specifically for testing
  tracesSampleRate: 1.0,
  integrations: [
    new Sentry.ReactNativeTracing({
      routingInstrumentation: new Sentry.ReactNavigationInstrumentation(),
    }),
  ],
});
import { NavigationContainer } from '@react-navigation/native';
const routingInstrumentation = new Sentry.ReactNavigationInstrumentation();
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { useNotifications } from './src/hooks/useNotifications';
import ErrorBoundary from './src/components/ErrorBoundary';

// --- IMPORTS ---
// --- IMPORTS ---
import { navigationRef } from './src/navigation/RootNavigation';
import { NotificationProvider } from './src/context/NotificationContext';
import { OfflineProvider } from './src/context/OfflineContext';
import * as Linking from 'expo-linking';
import SplashScreen from './src/SplashScreen';
import RegisterScreen from './src/RegisterScreen';
import LoginScreen from './src/LoginScreen';
import ForgotPasswordScreen from './src/ForgotPasswordScreen';
import ResetPasswordScreen from './src/ResetPasswordScreen';
import CareRecipientDashboard from './src/CareRecipientDashboard';
import CaregiverDashboard from './src/CaregiverDashboard';
import NewRequestScreen from './src/NewRequestScreen';
import Matchmaking from './src/Matchmaking';
import EmergencyScreen from './src/EmergencyScreen';
import NotificationsScreen from './src/NotificationsScreen';
import ProfileScreen from './src/ProfileScreen';
import ProfileScreen2 from './src/ProfileScreen2';
import EditProfileScreen from './src/EditProfileScreen';
import ChangePasswordScreen from './src/ChangePasswordScreen';

// --- SCHEDULE & PAYMENT IMPORTS ---
import ScheduleScreen from './src/ScheduleScreen';
import PaymentScreen from './src/PaymentScreen';

// --- MAP & TRACKING ---
// [FIXED] Point to the correct file name
import UpcomingVisitScreen from './src/UpcomingVisitScreen';
// Metro will automatically use CaregiverMapScreen.web.tsx on web, CaregiverMapScreen.tsx on native
import CaregiverMapScreen from './src/CaregiverMapScreen';

// --- NEW CAREGIVER SCREENS ---
import ScheduleScreen2 from './src/ScheduleScreen2';
import CaregiverAppointmentDetailScreen from './src/CaregiverAppointmentDetailScreen';

// --- CHAT IMPORTS ---
import ChatList from './src/ChatList';
import ChatDetailScreen from './src/ChatDetailScreen';
import ChatList2 from './src/ChatList2';
import ChatDetailScreen2 from './src/ChatDetailScreen2';
import ChatDetailsScreen from './src/ChatDetailsScreen';

// --- VIDEO CALL ---
import VideoCallScreen from './src/VideoCallScreen';

const Stack = createNativeStackNavigator();

function RootNavigator() {
  const { user, loading } = useAuth();
  // const navigationRef = React.useRef(null); // Removed old ref

  // Initialize notifications with navigation
  // useNotifications(navigationRef.current); // Removed old notifications

  if (loading) {
    return <SplashScreen />;
  }

  const isLoggedIn = !!user;
  const isCaregiver = user?.role === 'caregiver';
  // Use a key that changes when auth state changes to force remount
  const navKey = loading ? 'loading' : (isLoggedIn ? `logged-in-${user?.id}` : 'logged-out');

  return (
    <Stack.Navigator
      key={navKey}
      screenOptions={{ headerShown: false }}
      initialRouteName={isLoggedIn ? (isCaregiver ? "CaregiverDashboard" : "CareRecipientDashboard") : "Login"}
    >
      {!isLoggedIn ? (
        <>
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        </>
      ) : (
        <>
          {/* DASHBOARD ENTRY BASED ON ROLE */}
          {isCaregiver ? (
            <Stack.Screen name="CaregiverDashboard" component={CaregiverDashboard} />
          ) : (
            <Stack.Screen name="CareRecipientDashboard" component={CareRecipientDashboard} />
          )}

          {/* FEATURES */}
          <Stack.Screen name="NewRequestScreen" component={NewRequestScreen} />
          <Stack.Screen name="MatchmakingScreen" component={Matchmaking} />
          <Stack.Screen name="EmergencyScreen" component={EmergencyScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />

          {/* SCHEDULE & PAYMENT */}
          <Stack.Screen name="RecipientSchedule" component={ScheduleScreen} />
          <Stack.Screen name="PaymentScreen" component={PaymentScreen} />
          <Stack.Screen name="UpcomingVisitScreen" component={UpcomingVisitScreen} />
          <Stack.Screen name="CaregiverMapScreen" component={CaregiverMapScreen} />
          <Stack.Screen name="VideoCallScreen" component={VideoCallScreen} />

          {/* CHAT */}
          <Stack.Screen name="ChatList" component={ChatList} />
          <Stack.Screen name="ChatDetailScreen" component={ChatDetailScreen} />
          <Stack.Screen name="ChatDetailsScreen" component={ChatDetailsScreen} />
          <Stack.Screen name="ChatList2" component={ChatList2} />
          <Stack.Screen name="ChatDetailScreen2" component={ChatDetailScreen2} />

          {/* PROFILES */}
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="ProfileScreen2" component={ProfileScreen2} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} />
          <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />

          {/* LEGACY / CAREGIVER SCHEDULE FLOW */}
          <Stack.Screen name="Schedule" component={ScheduleScreen} />
          <Stack.Screen name="ScheduleScreen2" component={ScheduleScreen2} />
          <Stack.Screen name="CaregiverAppointmentDetailScreen" component={CaregiverAppointmentDetailScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

function App() {
  const linking = {
    prefixes: [Linking.createURL('/')],
    config: {
      screens: {
        ResetPassword: 'reset-password',
      },
    },
  };

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AuthProvider>
          <NotificationProvider>
            <OfflineProvider>
              <NavigationContainer
                ref={navigationRef}
                linking={linking}
                onReady={() => {
                  routingInstrumentation.registerNavigationContainer(navigationRef);
                }}
              >
                <RootNavigator />
              </NavigationContainer>
            </OfflineProvider>
          </NotificationProvider>
        </AuthProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(App);