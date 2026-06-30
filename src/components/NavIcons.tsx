// Shared SVG icon components for navigation (sidebar, bottom nav) and the Home
// card grid. Extracted from Layout so HomePage can reuse the same set.

interface IconProps { size: number; active: boolean; }

export function NewsIcon({ size, active }: IconProps) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      style={{ filter: active ? 'drop-shadow(0 0 4px rgba(168,85,247,0.6))' : 'none' }}
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M7 8h10M7 12h10M7 16h6" />
    </svg>
  );
}

export function LiveIcon({ size, active }: IconProps) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      style={{ filter: active ? 'drop-shadow(0 0 5px rgba(239,68,68,0.7))' : 'none', color: active ? '#ef4444' : 'currentColor' }}
    >
      <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
      <path d="M8.5 8.5a5 5 0 0 0 0 7" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M5 5a10 10 0 0 0 0 14" />
      <path d="M19 5a10 10 0 0 1 0 14" />
    </svg>
  );
}

export function PodiumIcon({ size, active }: IconProps) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      style={{ filter: active ? 'drop-shadow(0 0 4px rgba(168,85,247,0.6))' : 'none' }}
    >
      {/* podium steps: 2nd (left) | 1st (centre) | 3rd (right) */}
      <path d="M2 22 V11 H8 V5 H16 V15 H22 V22 Z" />
      <text x="11.5" y="10" textAnchor="middle" fontSize="4" fontWeight="700"
        stroke="none" fill="currentColor" fontFamily="sans-serif">1</text>
      <text x="5"    y="16" textAnchor="middle" fontSize="4" fontWeight="700"
        stroke="none" fill="currentColor" fontFamily="sans-serif">2</text>
      <text x="19"   y="20" textAnchor="middle" fontSize="4" fontWeight="700"
        stroke="none" fill="currentColor" fontFamily="sans-serif">3</text>
    </svg>
  );
}

export function SprintIcon({ size, active }: IconProps) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      style={{ filter: active ? 'drop-shadow(0 0 4px rgba(168,85,247,0.6))' : 'none' }}
    >
      {/* lightning bolt */}
      <path d="M13 2 L6 13 H12 L11 22 L18 11 H12 Z" />
    </svg>
  );
}

export function SprintQualIcon({ size, active }: IconProps) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      style={{ filter: active ? 'drop-shadow(0 0 4px rgba(168,85,247,0.6))' : 'none' }}
    >
      {/* stopwatch */}
      <circle cx="12" cy="13" r="8" />
      <path d="M12 5V2" />
      <path d="M10 2h4" />
      <path d="M12 13 L12 9" />
      <path d="M16.5 8.5 L18 7" />
      {/* S overlay */}
      <text x="8.5" y="17" fontSize="7" fontWeight="800"
        stroke="none" fill="currentColor" fontFamily="sans-serif">SQ</text>
    </svg>
  );
}

export function HomeIcon({ size, active }: IconProps) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      style={{ filter: active ? 'drop-shadow(0 0 4px rgba(168,85,247,0.6))' : 'none' }}
    >
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  );
}
