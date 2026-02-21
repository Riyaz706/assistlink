import { AssistLinkMap } from '@/components/Map';
import type { CaregiverMarker, MapCoordinate } from '@/types/map';

/**
 * Emergency: user location highlighted; optional responding caregiver.
 * Map failure must NEVER block SOS or emergency actions.
 */
interface EmergencyScreenProps {
  userPosition: MapCoordinate | null;
  /** Optional: caregiver responding to emergency. */
  respondingCaregiver?: CaregiverMarker | null;
}

export function EmergencyScreen({ userPosition, respondingCaregiver }: EmergencyScreenProps) {
  const caregivers = respondingCaregiver ? [respondingCaregiver] : [];

  return (
    <div className="flex min-h-screen flex-col bg-red-50">
      <header className="border-b-2 border-red-200 bg-white px-4 py-3">
        <h1 className="text-xl font-bold text-red-800">Emergency</h1>
        <p className="mt-1 text-sm text-gray-700">
          Your location is shown on the map. Help has been notified. You can still call emergency services.
        </p>
      </header>

      <main className="flex-1 p-4">
        <AssistLinkMap
          userPosition={userPosition}
          caregivers={caregivers}
          mode="emergency"
          ariaLabel="Emergency map showing your location and responder"
          className="h-[320px] w-full rounded-lg border-2 border-red-200"
        />
        <div className="mt-4 flex flex-col gap-2">
          <a
            href="tel:911"
            className="flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 text-lg font-semibold text-white"
          >
            Call emergency services
          </a>
          <p className="text-center text-sm text-gray-600">
            If the map did not load, your location was still shared. Stay on the line if you called.
          </p>
        </div>
      </main>
    </div>
  );
}
