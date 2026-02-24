import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../hooks/useNotifications';

// Auth Screens
import LoginScreen from '../LoginScreen';
import RegisterScreen from '../RegisterScreen';
import ForgotPasswordScreen from '../ForgotPasswordScreen';
import ResetPasswordScreen from '../ResetPasswordScreen';
import SplashScreen from '../SplashScreen';

// Care Recipient Screens
import CareRecipientDashboard from '../CareRecipientDashboard';
import UpcomingVisitScreen from '../UpcomingVisitScreen';
import CaregiverMapScreen from '../CaregiverMapScreen';
import NewRequestScreen from '../NewRequestScreen';
import ScheduleScreen from '../ScheduleScreen';
import ProfileScreen from '../ProfileScreen';
import ChatList from '../ChatList';
import ChatDetailsScreen from '../ChatDetailsScreen';
import Matchmaking from '../Matchmaking';
import PaymentScreen from '../PaymentScreen';

// Caregiver Screens
import CaregiverDashboard from '../CaregiverDashboard';
import ScheduleScreen2 from '../ScheduleScreen2';
import ProfileScreen2 from '../ProfileScreen2';
import ChatList2 from '../ChatList2';
import ChatDetailScreen2 from '../ChatDetailScreen2';
import CaregiverAppointmentDetailScreen from '../CaregiverAppointmentDetailScreen';

// Common Screens
import EmergencyScreen from '../EmergencyScreen';
import NotificationsScreen from '../NotificationsScreen';
import VideoCallScreen from '../VideoCallScreen';
import EditProfileScreen from '../EditProfileScreen';
import ChangePasswordScreen from '../ChangePasswordScreen';
import SettingsScreen from '../SettingsScreen';
import LanguagePickerScreen from '../LanguagePickerScreen';
import HelpSupportScreen from '../HelpSupportScreen';
import NSSPortalScreen from '../NSSPortalScreen';
import ProfileSetupScreen from '../ProfileSetupScreen';
import BookingsScreen from '../BookingsScreen';
import BookingDetailScreen from '../BookingDetailScreen';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
    const { user, loading } = useAuth();
    useNotifications();

    if (loading) {
        return (
            <Stack.Navigator id="LoadingStack" screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Splash" component={SplashScreen} />
            </Stack.Navigator>
        );
    }

    return (
        <Stack.Navigator
            id="MainStack"
            screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
                gestureEnabled: true,
                fullScreenGestureEnabled: true,
                animationTypeForReplace: 'push',
            }}
        >
            {!user ? (
                // Auth Stack
                <>
                    <Stack.Screen name="Login" component={LoginScreen} />
                    <Stack.Screen name="Register" component={RegisterScreen} />
                    <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
                    <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
                </>
            ) : (
                // Main Stack (Conditional based on role; fallback to care_recipient if role missing)
                <>
                    {(user?.role ?? 'care_recipient') === 'caregiver' ? (
                        // Caregiver Stack
                        <>
                            <Stack.Screen name="CaregiverDashboard" component={CaregiverDashboard} />
                            <Stack.Screen name="ScheduleScreen2" component={ScheduleScreen2} />
                            <Stack.Screen name="ChatList2" component={ChatList2} />
                            <Stack.Screen name="ChatDetailScreen2" component={ChatDetailScreen2} />
                            <Stack.Screen name="ProfileScreen2" component={ProfileScreen2} />
                            <Stack.Screen name="CaregiverAppointmentDetailScreen" component={CaregiverAppointmentDetailScreen} />
                        </>
                    ) : (
                        // Care Recipient Stack
                        <>
                            <Stack.Screen name="CareRecipientDashboard" component={CareRecipientDashboard} />
                            <Stack.Screen name="UpcomingVisitScreen" component={UpcomingVisitScreen} />
                            <Stack.Screen name="CaregiverMapScreen" component={CaregiverMapScreen} />
                            <Stack.Screen name="NewRequestScreen" component={NewRequestScreen} />
                            <Stack.Screen name="Schedule" component={ScheduleScreen} />
                            <Stack.Screen name="Profile" component={ProfileScreen} />
                            <Stack.Screen name="ChatList" component={ChatList} />
                            <Stack.Screen name="MatchmakingScreen" component={Matchmaking} />
                            <Stack.Screen name="PaymentScreen" component={PaymentScreen} />
                        </>
                    )}

                    {/* Common Screens accessible to both roles */}
                    <Stack.Screen name="EmergencyScreen" component={EmergencyScreen} />
                    <Stack.Screen name="Notifications" component={NotificationsScreen} />
                    <Stack.Screen name="VideoCallScreen" component={VideoCallScreen} />
                    <Stack.Screen name="EditProfile" component={EditProfileScreen} />
                    <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
                    <Stack.Screen name="ChatDetailsScreen" component={ChatDetailsScreen} />
                    <Stack.Screen name="Settings" component={SettingsScreen} />
                    <Stack.Screen name="LanguagePicker" component={LanguagePickerScreen} />
                    <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
                    <Stack.Screen name="NSSPortal" component={NSSPortalScreen} />
                    <Stack.Screen name="BookingsScreen" component={BookingsScreen} />
                    <Stack.Screen name="BookingDetailScreen" component={BookingDetailScreen} />
                    <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
                </>
            )}
        </Stack.Navigator>
    );
};

export default AppNavigator;
