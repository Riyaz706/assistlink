import { useState, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Vibration } from 'react-native';
import { api } from '../api/client';

// Configure notification behavior: every notification shows with sound and vibration
Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
        const isEmergency = notification.request.content.data?.notification_type === 'emergency' ||
            notification.request.content.data?.action === 'view_emergency';
        return {
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
            ...(Platform.OS === 'android' && {
                priority: isEmergency ? Notifications.AndroidNotificationPriority.MAX : Notifications.AndroidNotificationPriority.HIGH,
            }),
        };
    },
});

export function useNotifications(navigation?: any) {
    const [expoPushToken, setExpoPushToken] = useState<string>('');
    const [notification, setNotification] = useState<Notifications.Notification | undefined>(undefined);
    const notificationListener = useRef<Notifications.Subscription | undefined>(undefined);
    const responseListener = useRef<Notifications.Subscription | undefined>(undefined);

    useEffect(() => {
        registerForPushNotificationsAsync().then(token => {
            if (token) {
                setExpoPushToken(token);
                // Register with backend
                api.registerDevice({
                    device_token: token,
                    platform: Platform.OS,
                    device_info: {
                        deviceName: Device.deviceName || 'Unknown',
                        modelName: Device.modelName || 'Unknown',
                        osVersion: Device.osVersion || 'Unknown',
                    }
                }).catch(err => {
                    console.error('Failed to register device:', err);
                });
            }
        });

        // Listen for notifications while app is in foreground (sound + vibration for every notification)
        notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
            console.log('📬 Notification received:', notification);
            setNotification(notification);
            if (Platform.OS === 'web') return;
            const data = notification.request.content.data as Record<string, unknown> | undefined;
            const isEmergency = data?.notification_type === 'emergency' || data?.action === 'view_emergency';
            if (isEmergency) {
                Vibration.vibrate([0, 500, 200, 500, 200, 500]);
            } else {
                Vibration.vibrate([0, 100, 50, 100]);
            }
        });

        // Handle notification taps
        responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
            console.log('👆 Notification tapped:', response);
            handleNotificationAction(response.notification.request.content.data, navigation);
        });

        return () => {
            if (notificationListener.current) {
                notificationListener.current.remove();
            }
            if (responseListener.current) {
                responseListener.current.remove();
            }
        };
    }, [navigation]);

    return { expoPushToken, notification };
}

async function registerForPushNotificationsAsync() {
    let token;

    if (!Device.isDevice) {
        console.log('⚠️ Must use physical device for Push Notifications');
        return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        console.log('❌ Failed to get push token for push notification!');
        return null;
    }

    try {
        const pushTokenData = await Notifications.getExpoPushTokenAsync();
        token = pushTokenData.data;
        console.log('✅ Expo Push Token:', token);
    } catch (error: any) {
        console.log('⚠️ Failed to get push token. This is expected if you are not using a physical device or if you have not set up EAS Project ID.');
        if (error.message.includes('projectId')) {
            console.log('👉 To fix this, run "npx eas init" to create an EAS project, or test on a physical device with Expo Go logged in.');
        } else {
            console.error('Error getting push token:', error);
        }
        return null;
    }

    // Android-specific channels: HIGH/MAX importance so notifications show as heads-up (popup)
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'Notifications',
            importance: Notifications.AndroidImportance.MAX, // MAX = pop on screen (heads-up)
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#059669',
            sound: 'default',
            enableVibration: true,
        });
        await Notifications.setNotificationChannelAsync('emergency', {
            name: 'Emergency Alerts',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 500, 200, 500, 200, 500],
            lightColor: '#DC2626',
            sound: 'default',
            enableVibration: true,
        });
    }

    return token;
}

function handleNotificationAction(data: any, navigation?: any) {
    if (!navigation) {
        console.log('Navigation not available');
        return;
    }

    const action = data?.action;

    console.log('Handling notification action:', action, data);

    switch (action) {
        case 'open_chat':
            if (data.chat_session_id) {
                navigation.navigate('ChatDetailsScreen', {
                    chatSessionId: data.chat_session_id
                });
            }
            break;

        case 'view_booking':
            if (data.booking_id) {
                navigation.navigate('BookingDetails', {
                    bookingId: data.booking_id
                });
            }
            break;

        case 'view_video_call':
        case 'join_call':
            if (data.video_call_id) {
                navigation.navigate('VideoCallScreen', {
                    callId: data.video_call_id
                });
            }
            break;

        case 'view_emergency':
            if (data.emergency_id || data.care_recipient_id) {
                navigation.navigate('EmergencyScreen', {
                    emergency_id: data.emergency_id || data.care_recipient_id,
                    care_recipient_id: data.care_recipient_id,
                    location: data.location
                });
            }
            break;

        case 'view_payment':
            if (data.payment_id) {
                navigation.navigate('PaymentScreen', {
                    bookingId: data.payment_id
                });
            }
            break;

        default:
            // Navigate to notifications screen
            navigation.navigate('Notifications');
            break;
    }
}
