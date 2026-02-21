import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AssistLinkMap } from '@/components/Map';
import type { CaregiverMarker, MapCoordinate } from '@/types/map';

/** Example: nearby caregivers from API. No logic here; data from parent/backend. */
const MOCK_CAREGIVERS: CaregiverMarker[] = [
  { id: '1', type: 'caregiver', position: { lat: 20.594, lng: 78.963 }, label: 'Priya', subtitle: 'Available today' },
  { id: '2', type: 'caregiver', position: { lat: 20.595, lng: 78.965 }, label: 'Rahul', subtitle: 'Available tomorrow' },
];

export function CaregiverMatchingScreen() {
  const [view, setView] = useState<'list' | 'map'>('list');
  const [userPosition] = useState<MapCoordinate | null>({ lat: 20.5937, lng: 78.9629 });

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-4 py-3">
        <h1 className="text-xl font-semibold text-gray-900">Find a caregiver</h1>
        <div className="mt-2 flex gap-2" role="tablist" aria-label="View mode">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'list'}
            aria-controls="content"
            id="tab-list"
            onClick={() => setView('list')}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              view === 'list' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            List
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'map'}
            aria-controls="content"
            id="tab-map"
            onClick={() => setView('map')}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              view === 'map' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Map
          </button>
        </div>
      </header>

      <main id="content" role="tabpanel" className="flex-1 p-4">
        {view === 'list' && (
          <ul className="space-y-2">
            {MOCK_CAREGIVERS.map((c) => (
              <li key={c.id} className="rounded-lg border border-gray-200 bg-white p-4">
                <span className="font-medium">{c.label}</span>
                {c.subtitle && <span className="ml-2 text-sm text-gray-600">{c.subtitle}</span>}
                <div className="mt-2">
                  <Link
                    to={`/booking/slot?caregiverId=${encodeURIComponent(c.id)}&name=${encodeURIComponent(c.label)}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Book slot
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}

        {view === 'map' && (
          <AssistLinkMap
            userPosition={userPosition}
            caregivers={MOCK_CAREGIVERS}
            ariaLabel="Map of nearby caregivers. Click a marker for details."
            className="h-[400px] w-full"
          />
        )}
      </main>
    </div>
  );
}
