import type { SlotListItem } from '@/api/bookings';

export interface SlotPickerProps {
  slots: SlotListItem[];
  selectedSlot: SlotListItem | null;
  onSelect: (slot: SlotListItem) => void;
  slotDurationMinutes: number;
  loading?: boolean;
  error?: string | null;
  /** Format slot for display (e.g. local time). Default: format as ISO time. */
  formatSlot?: (start: string, end: string) => string;
}

function defaultFormat(start: string, end: string): string {
  try {
    const s = new Date(start);
    const e = new Date(end);
    const opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: true };
    return `${s.toLocaleTimeString(undefined, opts)} – ${e.toLocaleTimeString(undefined, opts)}`;
  } catch {
    return `${start} – ${end}`;
  }
}

/**
 * Slot picker: shows FREE vs BOOKED slots. Large touch targets (≥44px), color + text, no color-only.
 * User must select a FREE slot; no auto-selection.
 */
export function SlotPicker({
  slots,
  selectedSlot,
  onSelect,
  slotDurationMinutes,
  loading = false,
  error = null,
  formatSlot = defaultFormat,
}: SlotPickerProps) {
  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center text-gray-600" role="status" aria-live="polite">
        <p>Loading available slots…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800" role="alert">
        <p className="font-medium">{error}</p>
      </div>
    );
  }

  if (!slots.length) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-gray-600" role="status">
        <p>No slots in this range. Try another date.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700" id="slot-picker-desc">
        Choose a time. <span className="font-normal text-gray-500">Green = available, grey = already booked.</span>
      </p>
      <ul
        className="grid grid-cols-2 gap-2 sm:grid-cols-3"
        role="listbox"
        aria-labelledby="slot-picker-desc"
        aria-label="Available time slots"
      >
        {slots.map((slot) => {
          const isSelected =
            selectedSlot != null && selectedSlot.start === slot.start && selectedSlot.end === slot.end;
          const isAvailable = slot.available;
          const label = formatSlot(slot.start, slot.end);
          const statusText = isAvailable ? 'Available' : 'Booked';

          return (
            <li key={slot.start} role="option" aria-selected={isSelected}>
              <button
                type="button"
                disabled={!isAvailable}
                onClick={() => isAvailable && onSelect(slot)}
                className="min-h-[44px] min-w-[44px] rounded-lg border-2 px-3 py-2.5 text-left text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
                style={{
                  borderColor: isSelected ? 'var(--color-primary, #059669)' : undefined,
                  backgroundColor: isAvailable
                    ? isSelected
                      ? 'var(--color-primary-50, #ecfdf5)'
                      : '#ecfdf5'
                    : '#f3f4f6',
                  color: isAvailable ? '#065f46' : '#6b7280',
                }}
                aria-pressed={isSelected}
                aria-disabled={!isAvailable}
                aria-label={`${label}, ${statusText}${isSelected ? ', selected' : ''}`}
                title={isAvailable ? `Book ${label}` : `${label} is already booked`}
              >
                <span className="block">{label}</span>
                <span className="block text-xs font-normal opacity-90">
                  {statusText}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
