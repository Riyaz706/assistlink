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
import { useAuth } from './context/AuthContext';

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
    const [review, setReview] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const { user: currentUser } = useAuth();

    const fetchDetails = async (showLoading = true) => {
        try {
            if (showLoading) setLoading(true);
            const bookingPromise = api.request(`/api/bookings/${bookingId}`);
            const historyPromise = api.getBookingHistory(bookingId);
            const reviewPromise = api.getBookingReview(bookingId);

            const [bookingRes, historyRes, reviewRes] = await Promise.all([
                bookingPromise,
                historyPromise,
                reviewPromise.catch(() => null) // Ignore review fetch errors
            ]);

            setBooking(bookingRes);
            setHistory(historyRes as any[]);
            setReview(reviewRes);
        } catch (error) {
            console.error("Failed to fetch booking details", error);
            if (showLoading) {
                Alert.alert("Error", "Could not load booking details");
                navigation.goBack();
            }
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    const bookingStatusRef = React.useRef(booking?.status);
    useEffect(() => {
        bookingStatusRef.current = booking?.status;
    }, [booking?.status]);

    useEffect(() => {
        fetchDetails(true);

        // Realtime Subscription
        const channel = api.subscribeToBooking(bookingId, (payload) => {
            // Only refresh if status has changed to save battery/bandwidth
            if (payload && payload.status !== bookingStatusRef.current) {
                console.log('Realtime status update detected:', payload.status);
                fetchDetails(false); // Silent refresh
            }
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

    const [reviewModalVisible, setReviewModalVisible] = useState(false);
    const [rating, setRating] = useState(5);
    const [reviewText, setReviewText] = useState('');

    const handleReviewSubmit = async () => {
        try {
            setActionLoading(true);
            await api.submitReview({
                booking_id: bookingId,
                rating,
                comment: reviewText.trim() || undefined
            });
            setReviewModalVisible(false);
            Alert.alert("Success", "Thank you for your feedback!");
            fetchDetails();
        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to submit review");
        } finally {
            setActionLoading(false);
        }
    };

    const renderActionButtons = () => {
        if (!booking || !currentUser) return null;
        const status = booking.status;
        const isCareRecipient = currentUser.id === booking.care_recipient_id;
        const isCaregiver = String(currentUser.id) === String(booking.caregiver_id); // Handle potential type mismatch

        // Shared Actions (e.g. Video Call)
        // Only allow video call if booking is confirmed or in_progress (paid/active)
        const showVideoCall = ['confirmed', 'in_progress'].includes(status);

        return (
            <View>
                {/* Video Call Button */}
                {showVideoCall && (
                    <TouchableOpacity
                        style={[styles.button, styles.videoButton]}
                        onPress={() => navigation.navigate("VideoCallScreen", { bookingId })}
                    >
                        <Ionicons name="videocam" size={20} color="#FFF" style={{ marginRight: 8 }} />
                        <Text style={styles.buttonText}>Start Video Call</Text>
                    </TouchableOpacity>
                )}

                {/* Care Recipient Actions */}
                {isCareRecipient && (
                    <>
                        {status === 'accepted' && (
                            <TouchableOpacity
                                style={[styles.button, styles.primaryButton]}
                                onPress={() => navigation.navigate("PaymentScreen", { bookingId })}
                            >
                                <Text style={styles.buttonText}>Proceed to Payment</Text>
                            </TouchableOpacity>
                        )}

                        {['requested', 'accepted', 'confirmed'].includes(status) && (
                            <TouchableOpacity
                                style={[styles.button, styles.cancelButton]}
                                onPress={() => Alert.prompt("Cancel Booking", "Reason", (reason) => handleStatusUpdate("cancelled", reason))}
                            >
                                <Text style={styles.buttonText}>Cancel Booking</Text>
                            </TouchableOpacity>
                        )}

                        {status === 'completed' && !review && (
                            <TouchableOpacity
                                style={[styles.button, styles.primaryButton, { backgroundColor: '#FFD700' }]}
                                onPress={() => setReviewModalVisible(true)}
                            >
                                <Ionicons name="star" size={20} color="#FFF" style={{ marginRight: 8 }} />
                                <Text style={[styles.buttonText, { color: '#000' }]}>Rate Service</Text>
                            </TouchableOpacity>
                        )}
                    </>
                )}

                {/* Caregiver Actions */}
                {isCaregiver && (
                    <>
                        {status === 'requested' && (
                            <>
                                <TouchableOpacity
                                    style={[styles.button, styles.primaryButton]}
                                    onPress={() => handleStatusUpdate('accepted')}
                                >
                                    <Text style={styles.buttonText}>Accept Request</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.button, styles.cancelButton]}
                                    onPress={() => Alert.prompt("Reject Request", "Reason", (reason) => handleStatusUpdate("cancelled", reason))}
                                >
                                    <Text style={styles.buttonText}>Reject Request</Text>
                                </TouchableOpacity>
                            </>
                        )}

                        {status === 'confirmed' && (
                            <TouchableOpacity
                                style={[styles.button, styles.primaryButton, { backgroundColor: '#34C759' }]}
                                onPress={() => handleStatusUpdate('in_progress')}
                            >
                                <Text style={styles.buttonText}>Start Service</Text>
                            </TouchableOpacity>
                        )}

                        {status === 'in_progress' && (
                            <TouchableOpacity
                                style={[styles.button, styles.primaryButton, { backgroundColor: '#34C759' }]}
                                onPress={() => handleStatusUpdate('completed')}
                            >
                                <Text style={styles.buttonText}>Complete Service</Text>
                            </TouchableOpacity>
                        )}

                        {/* Caregiver can cancel if accepted or confirmed (but maybe with penalty logic later) */}
                        {['accepted', 'confirmed'].includes(status) && (
                            <TouchableOpacity
                                style={[styles.button, styles.cancelButton]}
                                onPress={() => Alert.prompt("Cancel Booking", "Reason", (reason) => handleStatusUpdate("cancelled", reason))}
                            >
                                <Text style={styles.buttonText}>Cancel Booking</Text>
                            </TouchableOpacity>
                        )}
                    </>
                )}
            </View>
        );
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
                <TouchableOpacity onPress={() => fetchDetails(true)}>
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

                {review && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Your Rating</Text>
                        <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                            {[1, 2, 3, 4, 5].map(s => (
                                <Ionicons
                                    key={s}
                                    name={s <= review.rating ? "star" : "star-outline"}
                                    size={24}
                                    color="#FFD700"
                                />
                            ))}
                        </View>
                        {review.comment && <Text style={styles.reviewComment}>{review.comment}</Text>}
                    </View>
                )}

                <View style={styles.section}>
                    {actionLoading ? <ActivityIndicator color="#007AFF" /> : renderActionButtons()}
                </View>

                <StatusTimeline history={history} />

            </ScrollView>

            <Modal
                transparent={true}
                visible={reviewModalVisible}
                onRequestClose={() => setReviewModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Rate Your Caregiver</Text>
                        <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 20 }}>
                            {[1, 2, 3, 4, 5].map(s => (
                                <TouchableOpacity key={s} onPress={() => setRating(s)}>
                                    <Ionicons
                                        name={s <= rating ? "star" : "star-outline"}
                                        size={40}
                                        color="#FFD700"
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>
                        <TextInput
                            style={styles.noteInput}
                            multiline
                            placeholder="Share your experience (optional)..."
                            value={reviewText}
                            onChangeText={setReviewText}
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={styles.modalButtonCancel} onPress={() => setReviewModalVisible(false)}>
                                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButtonConfirm, actionLoading && { opacity: 0.5 }]}
                                onPress={handleReviewSubmit}
                                disabled={actionLoading}
                            >
                                <Text style={styles.modalButtonTextConfirm}>Submit</Text>
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
        padding: 12,
        minWidth: 44,
        minHeight: 44,
        justifyContent: 'center',
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
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 12,
        minHeight: 52,
        justifyContent: 'center',
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
    },
    reviewComment: {
        fontSize: 14,
        color: '#666',
        fontStyle: 'italic',
        marginTop: 4,
    }
});

export default BookingDetailScreen;
