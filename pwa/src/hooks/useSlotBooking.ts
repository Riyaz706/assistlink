import { useState, useCallback } from 'react';
import { bookSlot, type SlotBookRequest, type BookingResponse } from '@/api/bookings';

export type SlotBookingErrorCode =
  | 'SLOT_ALREADY_BOOKED'
  | 'INVALID_TIME'
  | 'CAREGIVER_UNAVAILABLE'
  | 'NETWORK_FAILURE'
  | 'SESSION_EXPIRED'
  | 'UNKNOWN';

export interface SlotBookingState {
  isBooking: boolean;
  error: string | null;
  errorCode: SlotBookingErrorCode | null;
  success: BookingResponse | null;
}

function mapResponseToUserMessage(error: Error & { status?: number; code?: string }): {
  message: string;
  code: SlotBookingErrorCode;
} {
  const status = error.status;
  const code = (error.code ?? '') as string;
  const msg = error.message ?? '';

  if (status === 409 || /slot.*booked|already booked|conflict/i.test(msg) || /CONFLICT|23p01/i.test(code)) {
    return {
      message: 'This time slot was just taken. No problem — pick another green slot and try again.',
      code: 'SLOT_ALREADY_BOOKED',
    };
  }
  if (status === 422 || /invalid time|validation|past/i.test(msg) || /VALIDATION|22p02/i.test(code)) {
    if (/past|cannot book.*past/i.test(msg)) {
      return {
        message: 'That time has already passed. Please choose a future slot.',
        code: 'INVALID_TIME',
      };
    }
    return {
      message: 'Please choose a valid time (between 0.5 and 24 hours).',
      code: 'INVALID_TIME',
    };
  }
  if (status === 404 || /caregiver.*not found|not available|inactive/i.test(msg)) {
    return {
      message: 'This caregiver is not available right now. Please choose someone else.',
      code: 'CAREGIVER_UNAVAILABLE',
    };
  }
  if (status === 401 || /unauthorized|sign in|session|token/i.test(msg)) {
    return {
      message: 'Your session may have expired. Please sign in again and try again.',
      code: 'SESSION_EXPIRED',
    };
  }
  if (status === 0 || /network|failed to fetch/i.test(msg)) {
    return {
      message: 'We couldn’t reach the server. Check your connection and try again when you’re ready.',
      code: 'NETWORK_FAILURE',
    };
  }
  return {
    message: msg || 'Something went wrong. Please try again in a moment.',
    code: 'UNKNOWN',
  };
}

export function useSlotBooking() {
  const [state, setState] = useState<SlotBookingState>({
    isBooking: false,
    error: null,
    errorCode: null,
    success: null,
  });

  const book = useCallback(async (data: SlotBookRequest): Promise<BookingResponse | null> => {
    setState((s) => ({ ...s, isBooking: true, error: null, errorCode: null, success: null }));
    try {
      const result = await bookSlot(data);
      setState((s) => ({ ...s, isBooking: false, success: result, error: null, errorCode: null }));
      return result;
    } catch (err) {
      const { message, code } = mapResponseToUserMessage(err as Error & { status?: number; code?: string });
      setState((s) => ({ ...s, isBooking: false, error: message, errorCode: code, success: null }));
      return null;
    }
  }, []);

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null, errorCode: null }));
  }, []);

  const reset = useCallback(() => {
    setState({ isBooking: false, error: null, errorCode: null, success: null });
  }, []);

  return {
    book,
    clearError,
    reset,
    isBooking: state.isBooking,
    error: state.error,
    errorCode: state.errorCode,
    success: state.success,
  };
}
