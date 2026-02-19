import { api } from '../api/client';

export type BookingStatus =
    | 'draft'
    | 'requested'
    | 'accepted'
    | 'confirmed'
    | 'in_progress'
    | 'completed'
    | 'cancelled';

export interface Booking {
    id: string;
    status: BookingStatus;
    caregiver_id?: string;
    care_recipient_id: string;
    scheduled_date: string;
    duration_hours: number;
    [key: string]: any;
}

class BookingFlowManager {
    private subscriptions: Map<string, any> = new Map();

    /**
     * Subscribe to booking updates
     */
    subscribe(bookingId: string, onUpdate: (booking: Booking) => void) {
        if (this.subscriptions.has(bookingId)) {
            this.unsubscribe(bookingId);
        }

        const intervalId = api.subscribeToBooking(bookingId, (data) => {
            onUpdate(data as Booking);
        });

        this.subscriptions.set(bookingId, intervalId);
    }

    /**
     * Unsubscribe from booking updates
     */
    unsubscribe(bookingId: string) {
        const intervalId = this.subscriptions.get(bookingId);
        if (intervalId) {
            api.unsubscribeFromBooking(intervalId);
            this.subscriptions.delete(bookingId);
        }
    }

    /**
     * Role-based transitions
     */
    async requestBooking(bookingId: string): Promise<Booking> {
        return await api.updateBookingStatus(bookingId, 'requested') as Booking;
    }

    async acceptBooking(bookingId: string): Promise<Booking> {
        return await api.respondToBooking(bookingId, 'accepted') as Booking;
    }

    async rejectBooking(bookingId: string, reason?: string): Promise<Booking> {
        return await api.respondToBooking(bookingId, 'rejected', reason) as Booking;
    }

    async confirmBooking(bookingId: string): Promise<Booking> {
        // This usually happens after a payment verification
        return await api.updateBookingStatus(bookingId, 'confirmed') as Booking;
    }

    async startService(bookingId: string): Promise<Booking> {
        return await api.updateBookingStatus(bookingId, 'in_progress') as Booking;
    }

    async completeService(bookingId: string): Promise<Booking> {
        return await api.updateBookingStatus(bookingId, 'completed') as Booking;
    }

    async cancelBooking(bookingId: string, reason?: string): Promise<Booking> {
        return await api.updateBookingStatus(bookingId, 'cancelled', reason) as Booking;
    }
}

export const bookingFlowManager = new BookingFlowManager();
