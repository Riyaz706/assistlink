/**
 * Centralized user-facing labels for consistent, clear information across the app.
 * Use these for booking details, notifications, and status displays.
 */

/** Human-readable service type labels */
export const SERVICE_TYPE_LABELS: Record<string, string> = {
  exam_assistance: 'Exam Assistance',
  daily_care: 'Daily Care',
  one_time: 'One Time Visit',
  recurring: 'Recurring Care',
  video_call_session: 'Video Call Session',
  urgent_care: 'Urgent Care',
  emergency: 'Emergency',
};

/** Human-readable booking status labels */
export const BOOKING_STATUS_LABELS: Record<string, string> = {
  requested: 'Request Sent',
  pending: 'Awaiting Response',
  accepted: 'Accepted',
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rejected: 'Declined',
  declined: 'Declined',
};

/** Section titles for booking/schedule screens */
export const SECTION_LABELS = {
  SERVICE_DETAILS: 'Service Details',
  BOOKING_TIMELINE: 'Booking Timeline',
  NOTES: 'Notes',
  STATUS: 'Status',
  YOUR_RATING: 'Your Rating',
  ADD_NOTE: 'Add Note',
} as const;

/** Field labels for booking detail view */
export const FIELD_LABELS = {
  CARE_RECIPIENT: 'Care Recipient',
  CAREGIVER: 'Caregiver',
  SERVICE_TYPE: 'Service Type',
  DATE_TIME: 'Date & Time',
  DURATION: 'Duration',
  LOCATION: 'Location',
  SPECIAL_NEEDS: 'Special Requirements',
  CAREGIVER_NOTES: 'Caregiver Notes',
  NOT_SET: 'Not set',
  NO_LOCATION: 'Location not specified',
} as const;

/** Role labels when showing the other party in a booking */
export const ROLE_LABELS = {
  CAREGIVER: 'Caregiver',
  CARE_RECIPIENT: 'Care Recipient',
  ASSIGNED: 'Partner assigned',
} as const;

/** Get human-readable service type */
export function getServiceTypeLabel(serviceType: string): string {
  const key = (serviceType || '').toLowerCase().trim();
  return SERVICE_TYPE_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Get human-readable booking status */
export function getBookingStatusLabel(status: string): string {
  const key = (status || '').toLowerCase().trim();
  return BOOKING_STATUS_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
