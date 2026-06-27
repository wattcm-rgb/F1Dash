export type SectorColor = 'yellow' | 'green' | 'purple';

export function getSectorColor(
  currentTime: number,
  personalBest: number,
  overallBest: number
): SectorColor {
  if (currentTime === overallBest) {
    return 'purple';
  }
  if (currentTime === personalBest) {
    return 'green';
  }
  return 'yellow';
}

export function getSectorColorClass(color: SectorColor): string {
  switch (color) {
    case 'yellow':
      return 'bg-yellow-600 text-yellow-100';
    case 'green':
      return 'bg-green-600 text-green-100';
    case 'purple':
      return 'bg-purple-600 text-purple-100';
  }
}

export function formatTime(milliseconds: number): string {
  const minutes = Math.floor(milliseconds / 60000);
  const seconds = ((milliseconds % 60000) / 1000).toFixed(3);
  return `${minutes}:${parseFloat(seconds).toString().padStart(6, '0')}`;
}
