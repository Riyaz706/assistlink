import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { api } from './api/client';
import { LoadingState } from './components/LoadingState';
import { EmptyState } from './components/EmptyState';
import BottomNav from './BottomNav';

const StatusBadge = ({ status }: { status: string }) => {
    let color = '#666';
    let bgColor = '#f0f0f0';

    switch (status) {
        case 'requested':
            color = '#FF9500'; // Orange
            bgColor = '#FFF5E5';
            break;
        case 'accepted':
            color = '#007AFF'; // Blue
            bgColor = '#E5F1FF';
            break;
        case 'confirmed':
            color = '#34C759'; // Green
            bgColor = '#E8FAEB';
            break;
        case 'in_progress':
            color = '#AF52DE'; // Purple
            bgColor = '#F6E6FF';
            break;
        case 'completed':
            color = '#8E8E93'; // Gray
            bgColor = '#F2F2F7';
            break;
        case 'cancelled':
        case 'rejected':
            color = '#FF3B30'; // Red
            bgColor = '#FFE5E5';
            break;
    }

    return (
        <View style={[styles.badge, { backgroundColor: bgColor }]}>
            <Text style={[styles.badgeText, { color }]}>
                {status.toUpperCase().replace('_', ' ')}
            </Text>
        </View>
    );
};

const BookingItem = ({ item, onPress }: { item: any; onPress: () => void }) => {
    const date = new Date(item.scheduled_date).toLocaleDateString();
    const time = new Date(item.scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
        <TouchableOpacity style={styles.card} onPress={onPress}>
            <View style={styles.cardHeader}>
                <Text style={styles.serviceType}>
                    {item.service_type.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                </Text>
                <StatusBadge status={item.status} />
            </View>

            <View style={styles.cardBody}>
                <View style={styles.row}>
                    <Ionicons name="calendar-outline" size={16} color="#666" />
                    <Text style={styles.rowText}>{date} • {time}</Text>
                </View>
                <View style={styles.row}>
                    <Ionicons name="time-outline" size={16} color="#666" />
                    <Text style={styles.rowText}>{item.duration_hours} hours</Text>
                </View>
                {item.caregiver_id && (
                    <View style={styles.row}>
                        <Ionicons name="person-outline" size={16} color="#666" />
                        <Text style={styles.rowText}>Caregiver Assigned</Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
};

const BookingsScreen = () => {
    const navigation = useNavigation<any>();
    const [bookings, setBookings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchBookings = async () => {
        try {
            // Using dashboard/bookings to get list. This might need pagination loop for "all" 
            // or a dedicated endpoint, but typically dashboard/bookings is good start.
            // We'll assume it returns a list or { bookings: [...] } - checking client.ts logic, it calls /api/dashboard/bookings
            // The backend endpoint likely returns a list.
            const res = await api.getDashboardBookings({ limit: 50 });
            // If res is array, set it. If object with bookings key, set check.
            // Current backend at `bookings.py`? No, dashboard stats logic is separate.
            // Assuming it returns array as per typings in other projects, but let's be safe.

            if (Array.isArray(res)) {
                setBookings(res);
            } else if ((res as any).bookings) {
                setBookings((res as any).bookings);
            } else {
                // Fallback
                setBookings([]);
            }
        } catch (error) {
            console.error('Failed to fetch bookings', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchBookings();
        }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchBookings();
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" />
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                    accessibilityLabel="Go back"
                    accessibilityRole="button"
                >
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.title}>My Bookings</Text>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => navigation.navigate('NewRequestScreen')}
                    accessibilityLabel="Create new booking"
                    accessibilityRole="button"
                >
                    <Ionicons name="add" size={24} color="#FFF" />
                </TouchableOpacity>
            </View>

            {loading ? (
                <LoadingState message="Loading bookings..." />
            ) : (
                <FlatList
                    data={bookings}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <BookingItem
                            item={item}
                            onPress={() => navigation.navigate('BookingDetailScreen', { bookingId: item.id })}
                        />
                    )}
                    contentContainerStyle={bookings.length === 0 ? styles.listEmpty : styles.list}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                    ListEmptyComponent={
                        <EmptyState
                            icon="calendar-outline"
                            title="No bookings yet"
                            message="Create a request to get matched with a caregiver."
                            actionLabel="Create a booking"
                            onAction={() => navigation.navigate('NewRequestScreen')}
                        />
                    }
                />
            )}
            <BottomNav />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E5EA',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#000',
    },
    backButton: {
        minWidth: 48,
        minHeight: 48,
        justifyContent: 'center',
        marginRight: 16,
    },
    addButton: {
        backgroundColor: '#059669',
        minWidth: 48,
        minHeight: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listEmpty: {
        flexGrow: 1,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    list: {
        padding: 16,
        paddingBottom: 100,
    },
    card: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    serviceType: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '600',
    },
    cardBody: {
        gap: 8,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    rowText: {
        color: '#666',
        fontSize: 14,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 100,
        gap: 16,
    },
    emptyText: {
        fontSize: 18,
        color: '#999',
    },
    linkText: {
        color: '#007AFF',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default BookingsScreen;
