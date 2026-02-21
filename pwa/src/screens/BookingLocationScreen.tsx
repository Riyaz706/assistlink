import { AssistLinkMap } from '@/components/Map';

/**
 * Read-only location preview for booking.
 * No interaction required; map never blocks booking flow.
 */
interface BookingLocationScreenProps {
  /** Booking location from backend/form. */
  location: { lat: number; lng: number } | null;
}

export function BookingLocationScreen({ location }: BookingLocationScreenProps) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-4 py-3">
        <h1 className="text-xl font-semibold text-gray-900">Booking location</h1>
        <p className="mt-1 text-sm text-gray-600">Preview only. You can complete the booking without the map.</p>
      </header>

      <main className="flex-1 p-4">
        <AssistLinkMap
          userPosition={null}
          caregivers={[]}
          highlightPosition={location}
          defaultZoom={15}
          ariaLabel="Location preview for this booking"
          className="h-[280px] w-full"
        />
        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-600">
            If the map does not load, you can still confirm the booking. Address is saved separately.
          </p>
        </div>
      </main>
    </div>
  );
}
