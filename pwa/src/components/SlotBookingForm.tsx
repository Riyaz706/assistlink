import { useState, useCallback, useMemo } from 'react';
import { useSlotBooking } from '@/hooks/useSlotBooking';
import type { ServiceType } from '@/api/bookings';

/** When set, date/time and duration are fixed from this slot (no user editing). */
export interface FixedSlot {
  start: string;
  end: string;
}

export interface SlotBookingFormProps {
  caregiverId: string;
  caregiverName?: string;
  defaultServiceType?: ServiceType;
  defaultDurationHours?: number;
  onSuccess?: (bookingId: string) => void;
  onRetry?: () => void;
  /** Optional: pre-filled start time (ISO string). */
  initialStartTime?: string;
  /** When set, use this slot as scheduled_date + duration; hide date/duration inputs. */
  fixedSlot?: FixedSlot | null;
}

const SERVICE_LABELS: Record<ServiceType, string> = {
  exam_assistance: 'Exam assistance',
  daily_care: 'Daily care',
  one_time: 'One-time visit',
  recurring: 'Recurring care',
  video_call_session: 'Video call session',
};

function durationHoursFromSlot(start: string, end: string): number {
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (b <= a) return 1;
  return (b - a) / (60 * 60 * 1000);
}

export function SlotBookingForm({
  caregiverId,
  caregiverName = 'Caregiver',
  defaultServiceType = 'daily_care',
  defaultDurationHours = 2,
  onSuccess,
  onRetry,
  initialStartTime,
  fixedSlot,
}: SlotBookingFormProps) {
  const [serviceType, setServiceType] = useState<ServiceType>(defaultServiceType);
  const [date, setDate] = useState(() => {
    if (initialStartTime) {
      try {
        const d = new Date(initialStartTime);
        if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 16);
      } catch {
        // ignore
      }
    }
    const d = new Date();
    d.setMinutes(0);
    return d.toISOString().slice(0, 16);
  });
  const [duration, setDuration] = useState(defaultDurationHours);
  const [specificNeeds, setSpecificNeeds] = useState('');
  const [isEmergency, setIsEmergency] = useState(false);

  const { book, isBooking, error, errorCode, success, clearError, reset } = useSlotBooking();

  const scheduledDate = useMemo(() => {
    if (fixedSlot) return fixedSlot.start;
    const d = new Date(date);
    return d.toISOString();
  }, [fixedSlot, date]);

  const durationHours = useMemo(() => {
    if (fixedSlot) return durationHoursFromSlot(fixedSlot.start, fixedSlot.end);
    return duration;
  }, [fixedSlot, duration]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      clearError();
      const result = await book({
        caregiver_id: caregiverId,
        service_type: serviceType,
        scheduled_date: scheduledDate,
        duration_hours: durationHours,
        specific_needs: specificNeeds || undefined,
        is_emergency: isEmergency,
      });
      if (result) {
        onSuccess?.(result.id);
      }
    },
    [book, caregiverId, serviceType, scheduledDate, durationHours, specificNeeds, isEmergency, clearError, onSuccess]
  );

  const handleRetry = useCallback(() => {
    reset();
    clearError();
    onRetry?.();
  }, [reset, clearError, onRetry]);

  const isDisabled = isBooking;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label="Book a time slot">
      <div>
        <label htmlFor="slot-service" className="mb-1 block text-sm font-medium text-gray-700">
          Service type
        </label>
        <select
          id="slot-service"
          value={serviceType}
          onChange={(e) => setServiceType(e.target.value as ServiceType)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          disabled={isDisabled}
          aria-describedby="slot-service-desc"
        >
          {(Object.entries(SERVICE_LABELS) as [ServiceType, string][]).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <span id="slot-service-desc" className="sr-only">
          Choose type of care
        </span>
      </div>

      {fixedSlot ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700" role="status">
          <p className="font-medium">Selected time</p>
          <p className="mt-0.5">
            {new Date(fixedSlot.start).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}{' '}
            – {durationHoursFromSlot(fixedSlot.start, fixedSlot.end).toFixed(1)} hours
          </p>
        </div>
      ) : (
        <>
          <div>
            <label htmlFor="slot-datetime" className="mb-1 block text-sm font-medium text-gray-700">
              Date and time (your local time)
            </label>
            <input
              id="slot-datetime"
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              disabled={isDisabled}
              required
              aria-describedby="slot-datetime-desc"
            />
            <span id="slot-datetime-desc" className="text-xs text-gray-500">
              Times are stored in UTC; we recommend choosing a slot that fits your schedule.
            </span>
          </div>

          <div>
            <label htmlFor="slot-duration" className="mb-1 block text-sm font-medium text-gray-700">
              Duration (hours)
            </label>
            <input
              id="slot-duration"
              type="number"
              min={0.5}
              max={24}
              step={0.5}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              disabled={isDisabled}
              required
              aria-describedby="slot-duration-desc"
            />
            <span id="slot-duration-desc" className="text-xs text-gray-500">
              Between 0.5 and 24 hours
            </span>
          </div>
        </>
      )}

      <div>
        <label htmlFor="slot-needs" className="mb-1 block text-sm font-medium text-gray-700">
          Specific needs (optional)
        </label>
        <textarea
          id="slot-needs"
          value={specificNeeds}
          onChange={(e) => setSpecificNeeds(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          disabled={isDisabled}
          placeholder="e.g. mobility support, medication reminder"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="slot-emergency"
          type="checkbox"
          checked={isEmergency}
          onChange={(e) => setIsEmergency(e.target.checked)}
          disabled={isDisabled}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          aria-describedby="slot-emergency-desc"
        />
        <label htmlFor="slot-emergency" className="text-sm text-gray-700">
          Emergency request (override availability)
        </label>
        <span id="slot-emergency-desc" className="sr-only">
          Check for emergency; may allow booking even if caregiver appears busy
        </span>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          aria-live="polite"
        >
          <p className="font-medium">{error}</p>
          {(errorCode === 'SLOT_ALREADY_BOOKED' || errorCode === 'NETWORK_FAILURE') && (
            <button
              type="button"
              onClick={handleRetry}
              className="mt-2 text-red-700 underline focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              Try again with a different slot
            </button>
          )}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800"
          aria-live="polite"
        >
          <p className="font-medium">Booking confirmed</p>
          <p className="mt-1">
            Your request for {caregiverName} has been sent. Booking ID: {success.id.slice(0, 8)}…
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isDisabled}
          className="flex-1 rounded-lg bg-primary px-4 py-2.5 font-medium text-white focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
          aria-busy={isBooking}
          aria-disabled={isDisabled}
        >
          {isBooking ? 'Booking…' : 'Book slot'}
        </button>
        {success && (
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            Book another
          </button>
        )}
      </div>
    </form>
  );
}
