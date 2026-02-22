import React, { createContext, useCallback, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { Alert, Platform } from 'react-native';
import { useAuth } from './AuthContext';
import { api } from '../api/client';
import * as RootNavigation from '../navigation/RootNavigation';
import { getSupabase } from '../lib/supabase';

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
        if (!user?.id) {
            setAssignments([]);
            setActiveEmergency(null);
            return;
        }
        // Resolve role: prefer user.role (from /me), fallback to user_metadata for caregiver
        const role = (user as any).role ?? (user as any).user_metadata?.role;
        if (role !== 'caregiver') {
            setAssignments([]);
            setActiveEmergency(null);
            return;
        }

        try {
            if (!silent) {
                setLoading(true);
            }

            // Fetch both regular bookings AND video call requests (no upcoming_only so caregiver sees all active)
            const [bookings, videoCalls] = await Promise.all([
                api.getDashboardBookings({
                    status: 'requested,pending,accepted,confirmed,in_progress',
                    upcoming_only: false,
                    limit: 50
                }),
                api.getDashboardVideoCalls({ limit: 100 })
            ]);

            const rawBookings = Array.isArray(bookings) ? bookings : [];
            if (!silent) {
                console.log('[NotificationContext] Dashboard bookings count:', rawBookings.length, 'video calls:', Array.isArray(videoCalls) ? videoCalls.length : 0);
            }

            // Transform regular bookings to assignments
            const bookingAssignments: Assignment[] = rawBookings.map((booking: any) => {
                const rawRecipient = booking.care_recipient;
                const careRecipient = Array.isArray(rawRecipient) ? (rawRecipient[0] || {}) : (rawRecipient || {});
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

            // Transform video calls to assignments (only upcoming / pending)
            const rawVideoCalls = Array.isArray(videoCalls) ? videoCalls : [];
            const upcomingVideoCalls = rawVideoCalls.filter((vc: any) => {
                const status = (vc.status || '').toLowerCase();
                if (!['pending', 'accepted', 'in_progress'].includes(status)) return false;
                if (!vc.scheduled_time) return true;
                return new Date(vc.scheduled_time) >= new Date();
            });
            const videoCallAssignments: Assignment[] = upcomingVideoCalls.map((videoCall: any) => {
                const rawVcRecipient = videoCall.care_recipient;
                const vcRecipient = Array.isArray(rawVcRecipient) ? (rawVcRecipient[0] || {}) : (rawVcRecipient || {});

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

                let locationStr = 'Video Call';
                if (vcRecipient.address) {
                    if (typeof vcRecipient.address === 'string') {
                        locationStr = `Video Call - ${vcRecipient.address}`;
                    } else if (vcRecipient.address.text) {
                        locationStr = `Video Call - ${vcRecipient.address.text}`;
                    }
                }

                return {
                    id: videoCall.id,
                    clientName: vcRecipient.full_name || 'Care Recipient',
                    service: 'Video Call',
                    status: videoCall.status?.charAt(0).toUpperCase() + videoCall.status?.slice(1) || 'Pending',
                    time: timeStr,
                    address: locationStr,
                    image: vcRecipient.profile_photo_url || undefined,
                    bookingData: videoCall,
                };
            });

            // Merge and sort by date (soonest first); items with no date go last
            const allAssignments = [...bookingAssignments, ...videoCallAssignments].sort((a, b) => {
                const getSortKey = (item: Assignment) => {
                    const data = item.bookingData;
                    const dateStr = data?.scheduled_date || data?.scheduled_time;
                    return dateStr ? new Date(dateStr).getTime() : Number.MAX_SAFE_INTEGER;
                };
                return getSortKey(a) - getSortKey(b);
            });

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

            // 3. Emergency notifications are loaded by loadEmergencies() for all users (see useEffect)

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

    // Fetch emergency notifications for current user (caregivers receive these; care recipients get [])
    const loadEmergencies = async (silent = false) => {
        if (!user?.id) {
            setActiveEmergency(null);
            return;
        }
        try {
            const notificationsRes = await api.getNotifications({
                type: 'emergency',
                is_read: false,
                limit: 5
            }) as any;
            const list = Array.isArray(notificationsRes)
                ? notificationsRes
                : (notificationsRes?.data ?? notificationsRes?.notifications ?? []);
            const latestEmergency = list.length > 0 ? list[0] : null;
            if (latestEmergency) {
                setActiveEmergency({
                    id: latestEmergency.id,
                    user_id: latestEmergency.user_id,
                    recipientName: latestEmergency.data?.care_recipient_name || 'Care Recipient',
                    message: latestEmergency.message ?? latestEmergency.body ?? '',
                    data: latestEmergency.data ?? {},
                    created_at: latestEmergency.created_at
                });
            } else {
                setActiveEmergency(null);
            }
        } catch (err: any) {
            setActiveEmergency(null);
            if (!silent && err?.statusCode !== 401) {
                console.warn('[NotificationContext] Emergency notifications:', err?.message || err);
            }
        }
    };

    useEffect(() => {
        const role = user ? ((user as any).role ?? (user as any).user_metadata?.role) : null;
        // Always fetch emergency notifications when user is logged in (caregivers get them; banner only shows for caregiver UI)
        if (user?.id) {
            loadEmergencies(true);
        }
        if (user?.id && role === 'caregiver') {
            loadBookings();

            const userId = String(user.id);
            let realtimeChannel: { unsubscribe: () => void } | null = null;
            const supabase = getSupabase();
            if (supabase) {
                try {
                    realtimeChannel = supabase
                        .channel(`notifications:${userId}`)
                        .on(
                            'postgres_changes',
                            {
                                event: 'INSERT',
                                schema: 'public',
                                table: 'notifications',
                                filter: `user_id=eq.${userId}`,
                            },
                            () => {
                                loadBookings(true);
                                loadEmergencies(true);
                            }
                        )
                        .subscribe();
                } catch (e) {
                    console.warn('[NotificationContext] Realtime subscribe failed:', e);
                }
            }

            const intervalId = setInterval(() => {
                loadBookings(true);
                loadEmergencies(true);
            }, 10000);

            return () => {
                clearInterval(intervalId);
                if (realtimeChannel?.unsubscribe) realtimeChannel.unsubscribe();
            };
        } else {
            setAssignments([]);
            if (!user?.id) setActiveEmergency(null);
            prevAssignmentsCount.current = 0;
            isFirstLoad.current = true;
        }
    }, [user?.id, (user as any)?.role, (user as any)?.user_metadata?.role]);

    const refreshRef = useRef({ loadBookings, loadEmergencies });
    refreshRef.current = { loadBookings, loadEmergencies };
    const refresh = useCallback(async (silent?: boolean) => {
        await refreshRef.current.loadBookings(silent);
        await refreshRef.current.loadEmergencies(silent);
    }, []);

    return (
        <NotificationContext.Provider value={{
            assignments,
            activeEmergency,
            loading,
            refresh,
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
