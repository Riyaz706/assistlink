import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { Alert, Platform } from 'react-native';
import { useAuth } from './AuthContext';
import { api } from '../api/client';
import * as RootNavigation from '../navigation/RootNavigation';

// --- TYPES ---
export interface Assignment {
    id: string;
    clientName: string;
    service: string;
    status?: string;
    time?: string;
    address?: string;
    image?: string;
    bookingData?: any; // Store full booking data
}

export interface EmergencyAlert {
    id: string;
    user_id: string;
    recipientName: string;
    message: string;
    data: any;
    created_at: string;
}

interface NotificationContextType {
    assignments: Assignment[];
    activeEmergency: EmergencyAlert | null;
    loading: boolean;
    refresh: (silent?: boolean) => Promise<void>;
    dismissEmergency: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [activeEmergency, setActiveEmergency] = useState<EmergencyAlert | null>(null);
    const [loading, setLoading] = useState(false); // Default to false to not block UI

    // Ref to track previous assignment count for notifications
    const prevAssignmentsCount = useRef(0);
    // Ref to exclude initial load notification
    const isFirstLoad = useRef(true);

    // Load upcoming assignments from API
    const loadBookings = async (silent = false) => {
        // Only poll if user is logged in and is a caregiver
        if (!user || (user as any).role !== 'caregiver') {
            setActiveEmergency(null);
            return;
        }

        try {
            if (!silent) {
                setLoading(true);
            }

            // Fetch both regular bookings AND video call requests
            const [bookings, videoCalls] = await Promise.all([
                api.getDashboardBookings({
                    status: 'pending,accepted,in_progress',
                    upcoming_only: true, // Filter out past bookings
                    limit: 10
                }),
                api.getDashboardVideoCalls({ limit: 100 })
            ]);

            // Transform regular bookings to assignments
            const bookingAssignments: Assignment[] = (Array.isArray(bookings) ? bookings : []).map((booking: any) => {
                const careRecipient = booking.care_recipient || {};
                const serviceTypeMap: Record<string, string> = {
                    'exam_assistance': 'Exam Assistance',
                    'daily_care': 'Daily Care',
                    'one_time': 'One Time',
                    'recurring': 'Recurring',
                    'video_call_session': 'Video Call',
                };
                const serviceType = serviceTypeMap[booking.service_type] || booking.service_type || 'Service';

                // Format date and time
                let timeStr = 'Date not set';
                if (booking.scheduled_date) {
                    const scheduledDate = new Date(booking.scheduled_date);
                    const dateStr = scheduledDate.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                    });
                    const time = scheduledDate.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    timeStr = `${dateStr} at ${time}`;
                }

                // Format location
                let locationStr = 'Location not specified';
                if (booking.location) {
                    if (typeof booking.location === 'string') {
                        locationStr = booking.location;
                    } else if (booking.location.text) {
                        locationStr = booking.location.text;
                    } else if (booking.location.address) {
                        locationStr = booking.location.address;
                    }
                } else if (careRecipient.address) {
                    if (typeof careRecipient.address === 'string') {
                        locationStr = careRecipient.address;
                    } else if (careRecipient.address.text) {
                        locationStr = careRecipient.address.text;
                    }
                }

                return {
                    id: booking.id,
                    clientName: careRecipient.full_name || 'Care Recipient',
                    service: serviceType,
                    status: booking.status?.charAt(0).toUpperCase() + booking.status?.slice(1) || 'Pending',
                    time: timeStr,
                    address: locationStr,
                    image: careRecipient.profile_photo_url || undefined,
                    bookingData: booking, // Store full booking data for detail screen
                };
            });

            // Transform video calls to assignments
            const videoCallAssignments: Assignment[] = (Array.isArray(videoCalls) ? videoCalls : []).map((videoCall: any) => {
                const careRecipient = videoCall.care_recipient || {};

                // Format date and time
                let timeStr = 'Date not set';
                if (videoCall.scheduled_time) {
                    const scheduledDate = new Date(videoCall.scheduled_time);
                    const dateStr = scheduledDate.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                    });
                    const time = scheduledDate.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    timeStr = `${dateStr} at ${time}`;
                }

                // Format location
                let locationStr = 'Video Call';
                if (careRecipient.address) {
                    if (typeof careRecipient.address === 'string') {
                        locationStr = `Video Call - ${careRecipient.address}`;
                    } else if (careRecipient.address.text) {
                        locationStr = `Video Call - ${careRecipient.address.text}`;
                    }
                }

                return {
                    id: videoCall.id,
                    clientName: careRecipient.full_name || 'Care Recipient',
                    service: 'Video Call',
                    status: videoCall.status?.charAt(0).toUpperCase() + videoCall.status?.slice(1) || 'Pending',
                    time: timeStr,
                    address: locationStr,
                    image: careRecipient.profile_photo_url || undefined,
                    bookingData: videoCall, // Store full video call data
                };
            });

            // Merge both arrays
            const allAssignments = [...bookingAssignments, ...videoCallAssignments];

            console.log('[NotificationContext] Assignments updated. Count:', allAssignments.length);

            // Check for NEW assignments and trigger alert
            // Logic: If NOT first load, AND count increased => New Item!
            if (!isFirstLoad.current && allAssignments.length > prevAssignmentsCount.current) {
                // Find the new assignment(s)
                const newAssignment = allAssignments[0]; // Simplified: assume new ones are at top

                const navigateToDetails = (item: any) => {
                    const isVideoCall = item.service === 'Video Call';
                    const dataObject = item.bookingData || {};

                    RootNavigation.navigate('CaregiverAppointmentDetailScreen', {
                        appointment: {
                            id: item.id,
                            recipient: item.clientName,
                            service: item.service,
                            status: item.status || 'Pending',
                            date: item.time,
                            time: item.time,
                            location: item.address,
                            image: item.image,
                            bookingData: dataObject,
                            isVideoCall: isVideoCall,
                            videoCallUrl: isVideoCall ? dataObject.video_call_url : undefined,
                            bookingId: dataObject.booking_id || undefined,
                        }
                    });
                };

                Alert.alert(
                    "New Request!",
                    `You have a new ${newAssignment.service} request from ${newAssignment.clientName}`,
                    [
                        { text: "View", onPress: () => navigateToDetails(newAssignment) },
                        { text: "Dismiss" }
                    ]
                );
            }

            // Update refs
            prevAssignmentsCount.current = allAssignments.length;
            isFirstLoad.current = false;
            setAssignments(allAssignments);

            // 3. Fetch Emergency Notifications
            const notificationsRes = await api.getNotifications({
                type: 'emergency',
                is_read: false,
                limit: 1
            }) as any[];

            if (notificationsRes && notificationsRes.length > 0) {
                const latestEmergency = notificationsRes[0];
                setActiveEmergency({
                    id: latestEmergency.id,
                    user_id: latestEmergency.user_id,
                    recipientName: latestEmergency.data?.care_recipient_name || 'Care Recipient',
                    message: latestEmergency.message,
                    data: latestEmergency.data,
                    created_at: latestEmergency.created_at
                });
            } else {
                setActiveEmergency(null);
            }

        } catch (e: any) {
            console.error("[NotificationContext] Failed to load assignments:", e);
            setAssignments([]);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const dismissEmergency = () => {
        setActiveEmergency(null);
    };

    useEffect(() => {
        // Initial load logic
        if (user && (user as any).role === 'caregiver') {
            loadBookings();

            // Polling every 5 seconds
            const intervalId = setInterval(() => {
                loadBookings(true); // Silent refresh
            }, 5000);

            return () => clearInterval(intervalId);
        } else {
            // Reset if user logs out or changes
            setAssignments([]);
            prevAssignmentsCount.current = 0;
            isFirstLoad.current = true;
        }
    }, [user]); // Re-run when user changes

    return (
        <NotificationContext.Provider value={{
            assignments,
            activeEmergency,
            loading,
            refresh: (silent) => loadBookings(silent),
            dismissEmergency
        }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotification = () => {
    const ctx = useContext(NotificationContext);
    if (!ctx) {
        throw new Error("useNotification must be used within NotificationProvider");
    }
    return ctx;
};
