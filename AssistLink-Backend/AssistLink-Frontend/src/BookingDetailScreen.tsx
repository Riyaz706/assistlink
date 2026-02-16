import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    TextInput,
    Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { api } from './api/client';

const StatusTimeline = ({ history }: { history: any[] }) => {
    if (!history || history.length === 0) return null;

    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Timeline</Text>
            <View style={styles.timeline}>
                {history.map((entry, index) => (
                    <View key={entry.id} style={styles.timelineItem}>
                        <View style={[styles.timelineDot, { backgroundColor: index === 0 ? '#007AFF' : '#CCC' }]} />
                        {index !== history.length - 1 && <View style={styles.timelineLine} />}
                        <View style={styles.timelineContent}>
                            <Text style={styles.timelineStatus}>
                                {entry.new_status.toUpperCase().replace('_', ' ')}
                            </Text>
                            <Text style={styles.timelineDate}>
                                {new Date(entry.created_at).toLocaleString()}
                            </Text>
                            {entry.reason && (
                                <Text style={styles.timelineReason}>Note: {entry.reason}</Text>
                            )}
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
};

const BookingDetailScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { bookingId } = route.params;

    const [booking, setBooking] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const fetchDetails = async () => {
        try {
            setLoading(true);
            // We assume getBookingHistory works. For getBooking, we might need a specific endpoint
            // if api.getBookings() returns list. We'll use api.request for now.
            const bookingPromise = api.request(`/api/bookings/${bookingId}`);
            const historyPromise = api.getBookingHistory(bookingId);

            const [bookingRes, historyRes] = await Promise.all([bookingPromise, historyPromise]);

            setBooking(bookingRes);
            setHistory(historyRes as any[]);
        } catch (error) {
            console.error("Failed to fetch booking details", error);
            Alert.alert("Error", "Could not load booking details");
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDetails();

        // Realtime Subscription
        const channel = api.subscribeToBooking(bookingId, (payload) => {
            console.log('Realtime update:', payload);
            fetchDetails(); // Refresh full details on any change
        });

        return () => {
            api.unsubscribeFromBooking(channel);
        };
    }, [bookingId]);

    const handleStatusUpdate = async (newStatus: string, reason?: string) => {
        try {
            setActionLoading(true);
            if (newStatus === 'accepted' || newStatus === 'rejected') {
                await api.respondToBooking(bookingId, newStatus as any, reason);
            } else if (newStatus === 'cancelled') {
                await api.cancelBooking(bookingId);
            } else {
                await api.updateBookingStatus(bookingId, newStatus, reason);
            }
            Alert.alert("Success", `Booking ${newStatus}`);
            fetchDetails();
        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to update status");
        } finally {
            setActionLoading(false);
        }
    };

    const [noteModalVisible, setNoteModalVisible] = useState(false);
    const [noteText, setNoteText] = useState('');

    const handleAddNote = async () => {
        if (!noteText.trim()) return;
        try {
            await api.addBookingNote(bookingId, noteText, false); // isPrivate=false default
            setNoteModalVisible(false);
            setNoteText('');
            Alert.alert("Success", "Note added");
            // Refresh history to see changes if logic supported, or just fetch details
            // For now, refresh details just in case
            fetchDetails();
        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to add note");
        }
    };

    const renderActionButtons = () => {
        if (!booking) return null;
        const status = booking.status;

        // Simplistic Role Check based on logic (in real app, use user context)
        // Here we just render buttons generically or assuming Care Recipient for MVP demo
        // Ideally we check `currentUser.role`

        if (['accepted', 'confirmed', 'in_progress'].includes(status)) {
            return (
                <>
                    <TouchableOpacity
                        style={[styles.button, styles.videoButton]}
                        onPress={() => navigation.navigate("VideoCallScreen", { bookingId })}
                    >
                        <Ionicons name="videocam" size={20} color="#FFF" style={{ marginRight: 8 }} />
                        <Text style={styles.buttonText}>Start Video Call</Text>
                    </TouchableOpacity>

                    {status === 'accepted' && (
                        <TouchableOpacity
                            style={[styles.button, styles.primaryButton]}
                            onPress={() => navigation.navigate("PaymentScreen", { bookingId })}
                        >
                            <Text style={styles.buttonText}>Proceed to Payment</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={[styles.button, styles.cancelButton]}
                        onPress={() => Alert.prompt("Cancel Booking", "Reason", (reason) => handleStatusUpdate("cancelled", reason))}
                    >
                        <Text style={styles.buttonText}>Cancel Booking</Text>
                    </TouchableOpacity>
                </>
            );
        }

        return null;
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        );
    }

    if (!booking) {
        return (
            <View style={styles.center}>
                <Text>Booking not found</Text>
            </View>
        )
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Booking Details</Text>
                <TouchableOpacity onPress={fetchDetails}>
                    <Ionicons name="refresh" size={24} color="#007AFF" />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>

                <View style={styles.statusBanner}>
                    <Text style={styles.statusLabel}>Status</Text>
                    <Text style={[styles.statusValue, { color: getStatusColor(booking.status) }]}>
                        {booking.status.toUpperCase().replace('_', ' ')}
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Service Details</Text>
                    {booking.care_recipient && <DetailRow label="Recipient" value={booking.care_recipient.full_name} />}
                    {booking.caregiver && <DetailRow label="Caregiver" value={booking.caregiver.full_name} />}
                    <DetailRow label="Type" value={booking.service_type} />
                    <DetailRow label="Date" value={new Date(booking.scheduled_date).toLocaleString()} />
                    <DetailRow label="Duration" value={`${booking.duration_hours} hours`} />
                    {booking.location && (
                        <DetailRow
                            label="Location"
                            value={
                                typeof booking.location === 'string'
                                    ? booking.location
                                    : (booking.location.address || booking.location.text || 'Map Location')
                            }
                        />
                    )}
                    {booking.specific_requirements && <DetailRow label="Requirements" value={booking.specific_requirements} />}
                    {booking.caregiver_notes && <DetailRow label="Caregiver Notes" value={booking.caregiver_notes} />}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Notes</Text>
                    <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={() => setNoteModalVisible(true)}>
                        <Text style={styles.secondaryButtonText}>Add Note</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.section}>
                    {actionLoading ? <ActivityIndicator color="#007AFF" /> : renderActionButtons()}
                </View>

                <StatusTimeline history={history} />

            </ScrollView>

            <Modal
                transparent={true}
                visible={noteModalVisible}
                onRequestClose={() => setNoteModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Add Note</Text>
                        <TextInput
                            style={styles.noteInput}
                            multiline
                            placeholder="Enter note..."
                            value={noteText}
                            onChangeText={setNoteText}
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={styles.modalButtonCancel} onPress={() => setNoteModalVisible(false)}>
                                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalButtonConfirm} onPress={handleAddNote}>
                                <Text style={styles.modalButtonTextConfirm}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const DetailRow = ({ label, value }: { label: string, value: string }) => (
    <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
    </View>
);

const getStatusColor = (status: string) => {
    switch (status) {
        case 'requested': return '#FF9500';
        case 'accepted': return '#007AFF';
        case 'confirmed': return '#34C759';
        case 'cancelled': return '#FF3B30';
        default: return '#333';
    }
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E5EA',
        justifyContent: 'space-between'
    },
    backButton: {
        paddingRight: 16,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    scrollContent: {
        padding: 16,
    },
    statusBanner: {
        backgroundColor: '#FFF',
        padding: 20,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 16,
        elevation: 2,
    },
    statusLabel: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4,
    },
    statusValue: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    section: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 12,
        color: '#333',
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        paddingBottom: 8,
    },
    detailLabel: {
        color: '#666',
        fontSize: 15,
    },
    detailValue: {
        fontWeight: '500',
        color: '#333',
        maxWidth: '60%',
        textAlign: 'right',
    },
    button: {
        padding: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 8,
    },
    primaryButton: {
        backgroundColor: '#007AFF',
    },
    secondaryButton: {
        backgroundColor: '#E5E5EA',
    },
    secondaryButtonText: {
        color: '#007AFF',
        fontWeight: '600',
        fontSize: 16,
    },
    cancelButton: {
        backgroundColor: '#FF3B30',
    },
    buttonText: {
        color: '#FFF',
        fontWeight: '600',
        fontSize: 16,
    },
    videoButton: {
        backgroundColor: '#5856D6', // Purple for video
        flexDirection: 'row',
        justifyContent: 'center',
    },
    timeline: {
        marginTop: 8,
    },
    timelineItem: {
        flexDirection: 'row',
        marginBottom: 20,
    },
    timelineDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginTop: 4,
        zIndex: 1,
    },
    timelineLine: {
        position: 'absolute',
        left: 5,
        top: 16,
        bottom: -20,
        width: 2,
        backgroundColor: '#E0E0E0',
        zIndex: 0,
    },
    timelineContent: {
        marginLeft: 16,
        flex: 1,
    },
    timelineStatus: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    timelineDate: {
        fontSize: 12,
        color: '#999',
        marginTop: 2,
    },
    timelineReason: {
        fontSize: 13,
        color: '#666',
        marginTop: 4,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 20,
        width: '80%',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 12,
    },
    noteInput: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 8,
        padding: 10,
        height: 100,
        textAlignVertical: 'top',
        marginBottom: 16,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    modalButtonCancel: {
        marginRight: 16,
    },
    modalButtonConfirm: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    modalButtonTextCancel: {
        color: '#666',
        fontWeight: '600',
        paddingVertical: 8,
    },
    modalButtonTextConfirm: {
        color: '#FFF',
        fontWeight: '600',
    }
});

export default BookingDetailScreen;
