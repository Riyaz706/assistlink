interface MapLoadingProps {
  className?: string;
}

export function MapLoading({ className = '' }: MapLoadingProps) {
  return (
    <div
      role="status"
      aria-label="Map loading"
      className={`flex min-h-[280px] flex-col items-center justify-center rounded-lg border border-gray-200 bg-gray-50 ${className}`}
    >
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="mt-3 text-sm text-gray-600">Loading map…</p>
    </div>
  );
}
