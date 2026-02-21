interface MapFallbackProps {
  title: string;
  message: string;
  className?: string;
  role?: 'status' | 'alert';
}

/**
 * Shown when map fails to load. Never blocks app flow.
 * Accessible and touch-friendly.
 */
export function MapFallback({ title, message, className = '', role = 'status' }: MapFallbackProps) {
  return (
    <div
      role={role}
      aria-live="polite"
      className={`flex min-h-[280px] flex-col items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-6 text-center ${className}`}
    >
      <span className="text-4xl" aria-hidden="true">
        📍
      </span>
      <h3 className="mt-3 text-lg font-semibold text-gray-800">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-gray-600">{message}</p>
    </div>
  );
}
