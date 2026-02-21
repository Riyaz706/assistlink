import { API_BASE, getAuthToken } from '@/config/api';

export type ServiceType = 'exam_assistance' | 'daily_care' | 'one_time' | 'recurring' | 'video_call_session';

export interface SlotAvailabilityResult {
  available: boolean;
  caregiver_id: string;
  start_time: string;
  end_time: string;
}

/** Single slot from GET /api/caregivers/:id/slots. All times ISO UTC. */
export interface SlotListItem {
  start: string;
  end: string;
  available: boolean;
}

export async function getCaregiverSlots(
  caregiverId: string,
  fromDate: string,
  toDate: string,
  slotDurationMinutes: number = 60
): Promise<SlotListItem[]> {
  const params: Record<string, string> = {
    from_date: fromDate,
    to_date: toDate,
    slot_duration_minutes: String(slotDurationMinutes),
  };
  const url = `${API_BASE}/api/caregivers/${encodeURIComponent(caregiverId)}/slots?${new URLSearchParams(params).toString()}`;
  const token = getAuthToken();
  const res = await fetch(url, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const body = (await res.json().catch(() => ({}))) as ApiErrorBody & SlotListItem[];
  if (!res.ok) {
    const message =
      (body as ApiErrorBody).error?.message ||
      (typeof (body as ApiErrorBody).detail === 'string'
        ? (body as ApiErrorBody).detail
        : 'Request failed');
    const err = new Error(message) as Error & { status?: number; code?: string };
    err.status = res.status;
    err.code = (body as ApiErrorBody).error?.code;
    throw err;
  }
  return body as SlotListItem[];
}

export interface SlotBookRequest {
  caregiver_id: string;
  service_type: ServiceType;
  scheduled_date: string; // ISO 8601
  duration_hours: number;
  location?: { lat: number; lng: number; address?: string };
  specific_needs?: string;
  is_emergency?: boolean;
  video_call_request_id?: string;
  chat_session_id?: string;
}

export interface BookingResponse {
  id: string;
  care_recipient_id: string;
  caregiver_id: string | null;
  service_type: string;
  scheduled_date: string;
  duration_hours: number;
  status: string;
  created_at: string;
  [key: string]: unknown;
}

export interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    status?: number;
  };
  detail?: string | Array<{ msg: string }>;
}

async function request<T>(
  path: string,
  options: RequestInit & { params?: Record<string, string> } = {}
): Promise<T> {
  const { params, ...rest } = options;
  const url = params
    ? `${API_BASE}${path}?${new URLSearchParams(params).toString()}`
    : `${API_BASE}${path}`;
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(rest.headers ?? {}),
  };
  const res = await fetch(url, { ...rest, headers });
  const body = (await res.json().catch(() => ({}))) as ApiErrorBody & T;
  if (!res.ok) {
    const message =
      (body as ApiErrorBody).error?.message ||
      (typeof (body as ApiErrorBody).detail === 'string'
        ? (body as ApiErrorBody).detail
        : Array.isArray((body as ApiErrorBody).detail)
          ? (body as ApiErrorBody).detail?.map((d) => d.msg).join(', ')
          : 'Request failed');
    const err = new Error(message) as Error & { status?: number; code?: string };
    err.status = res.status;
    err.code = (body as ApiErrorBody).error?.code;
    throw err;
  }
  return body as T;
}

export async function checkSlotAvailability(
  caregiverId: string,
  startTime: string,
  endTime: string
): Promise<SlotAvailabilityResult> {
  return request<SlotAvailabilityResult>('/api/bookings/slot-availability', {
    method: 'GET',
    params: {
      caregiver_id: caregiverId,
      start_time: startTime,
      end_time: endTime,
    },
  });
}

export async function bookSlot(data: SlotBookRequest): Promise<BookingResponse> {
  const payload = {
    caregiver_id: data.caregiver_id,
    service_type: data.service_type,
    scheduled_date: data.scheduled_date,
    duration_hours: data.duration_hours,
    location: data.location ?? null,
    specific_needs: data.specific_needs ?? null,
    is_emergency: data.is_emergency ?? false,
    video_call_request_id: data.video_call_request_id ?? null,
    chat_session_id: data.chat_session_id ?? null,
  };
  return request<BookingResponse>('/api/bookings/slot', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
