import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { CaregiverMatchingScreen } from '@/screens/CaregiverMatchingScreen';
import { BookingLocationScreen } from '@/screens/BookingLocationScreen';
import { SlotBookingScreen } from '@/screens/SlotBookingScreen';
import { EmergencyScreen } from '@/screens/EmergencyScreen';

export default function App() {
  return (
    <BrowserRouter>
      <nav className="border-b border-gray-200 bg-white px-4 py-2" aria-label="Main">
        <ul className="flex gap-4 text-sm">
          <li>
            <Link to="/" className="text-primary font-medium hover:underline">
              Matching
            </Link>
          </li>
          <li>
            <Link to="/booking" className="text-gray-600 hover:underline">
              Booking
            </Link>
          </li>
          <li>
            <Link to="/emergency" className="text-gray-600 hover:underline">
              Emergency
            </Link>
          </li>
        </ul>
      </nav>
      <Routes>
        <Route path="/" element={<CaregiverMatchingScreen />} />
        <Route path="/booking" element={<BookingLocationScreen location={{ lat: 20.5937, lng: 78.9629 }} />} />
        <Route path="/booking/slot" element={<SlotBookingScreen />} />
        <Route
          path="/emergency"
          element={
            <EmergencyScreen
              userPosition={{ lat: 20.5937, lng: 78.9629 }}
              respondingCaregiver={{
                id: 'r1',
                type: 'caregiver',
                position: { lat: 20.594, lng: 78.963 },
                label: 'Responder',
                subtitle: 'On the way',
              }}
            />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
