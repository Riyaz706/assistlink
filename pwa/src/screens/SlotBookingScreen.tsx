import { useState, useCallback, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { SlotPicker } from '@/components/SlotPicker';
import { SlotBookingForm } from '@/components/SlotBookingForm';
import { getCaregiverSlots } from '@/api/bookings';
import type { SlotListItem } from '@/api/bookings';

const SLOT_DURATION_MINUTES = 60;

function dayStartUTC(dateStr: string): string {
  return dateStr + 'T00:00:00.000Z';
}

function dayEndUTC(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00.000Z');
  return new Date(d.getTime() + 24 * 60 * 60 * 1000).toISOString();
}

export function SlotBookingScreen() {
  const [searchParams] = useSearchParams();
  const caregiverId = searchParams.get('caregiverId') ?? '';
  const caregiverName = searchParams.get('name') ?? 'Caregiver';

  const [dateInput, setDateInput] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [slots, setSlots] = useState<SlotListItem[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SlotListItem | null>(null);

  const fetchSlots = useCallback(() => {
    if (!caregiverId || !dateInput) return;
    setSlotsLoading(true);
    setSlotsError(null);
    const from = dayStartUTC(dateInput);
    const to = dayEndUTC(dateInput);
    getCaregiverSlots(caregiverId, from, to, SLOT_DURATION_MINUTES)
      .then(setSlots)
      .catch((err) => setSlotsError(err.message ?? 'Could not load slots'))
      .finally(() => setSlotsLoading(false));
  }, [caregiverId, dateInput]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const handleSelectSlot = useCallback((slot: SlotListItem) => {
    setSelectedSlot(slot);
  }, []);

  const handlePickAnotherSlot = useCallback(() => {
    setSelectedSlot(null);
  }, []);

  const handleBookingConflict = useCallback(() => {
    setSelectedSlot(null);
    fetchSlots();
  }, [fetchSlots]);

  if (!caregiverId) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-50">
        <header className="border-b border-gray-200 bg-white px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-gray-600">
            <Link to="/" className="hover:underline">Matching</Link>
            <span aria-hidden>/</span>
            <Link to="/booking" className="hover:underline">Booking</Link>
            <span aria-hidden>/</span>
            <span className="text-gray-900 font-medium">Book slot</span>
          </nav>
          <h1 className="mt-2 text-xl font-semibold text-gray-900">Book a time slot</h1>
        </header>
        <main className="flex-1 p-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800" role="alert">
            <p className="font-medium">No caregiver selected</p>
            <p className="mt-1 text-sm">
              Go to <Link to="/" className="underline">Matching</Link> to choose a caregiver, then open &quot;Book slot&quot;.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-4 py-3">
        <nav className="flex items-center gap-2 text-sm text-gray-600">
          <Link to="/" className="hover:underline">Matching</Link>
          <span aria-hidden>/</span>
          <Link to="/booking" className="hover:underline">Booking</Link>
          <span aria-hidden>/</span>
          <span className="text-gray-900 font-medium">Book slot</span>
        </nav>
        <h1 className="mt-2 text-xl font-semibold text-gray-900">Book a time slot</h1>
        <p className="mt-1 text-sm text-gray-600">
          {caregiverName}
          <span className="text-gray-500"> (ID: {caregiverId.slice(0, 8)}…)</span>
        </p>
      </header>

      <main className="flex-1 p-4 space-y-6">
        <section aria-label="Choose date and time slot">
          <label htmlFor="slot-date" className="mb-2 block text-sm font-medium text-gray-700">
            Date
          </label>
          <input
            id="slot-date"
            type="date"
            value={dateInput}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => {
              setDateInput(e.target.value);
              setSelectedSlot(null);
            }}
            className="mb-4 rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            aria-describedby="slot-date-desc"
          />
          <p id="slot-date-desc" className="sr-only">
            Pick a day to see available time slots
          </p>

          <SlotPicker
            slots={slots}
            selectedSlot={selectedSlot}
            onSelect={handleSelectSlot}
            slotDurationMinutes={SLOT_DURATION_MINUTES}
            loading={slotsLoading}
            error={slotsError}
          />
        </section>

        {selectedSlot && (
          <section aria-label="Booking details" className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-medium text-gray-900">Confirm booking</h2>
            <SlotBookingForm
              caregiverId={caregiverId}
              caregiverName={caregiverName}
              fixedSlot={{ start: selectedSlot.start, end: selectedSlot.end }}
              onSuccess={(id) => {
                console.log('Booking created:', id);
              }}
              onRetry={handleBookingConflict}
            />
            <p className="mt-3">
              <button
                type="button"
                onClick={handlePickAnotherSlot}
                className="text-sm text-gray-600 underline hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              >
                Choose a different time
              </button>
            </p>
          </section>
        )}

        {!selectedSlot && slots.length > 0 && (
          <p className="text-sm text-gray-500">
            Select an <strong>Available</strong> time above to continue. Booked slots cannot be selected.
          </p>
        )}
      </main>
    </div>
  );
}
