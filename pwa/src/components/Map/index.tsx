/**
 * Reusable view-only map. API key from env.
 * Never blocks app flow; shows fallback on failure.
 */
import { AssistLinkMapView } from './AssistLinkMapView';
import type { MapViewProps } from '@/types/map';

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

export function AssistLinkMap(props: Omit<MapViewProps, 'apiKey'>) {
  return <AssistLinkMapView {...props} apiKey={apiKey} />;
}

export { AssistLinkMapView } from './AssistLinkMapView';
export { MapFallback } from './MapFallback';
export { MapLoading } from './MapLoading';
