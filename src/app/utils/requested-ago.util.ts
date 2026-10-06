const MS_PER_HOUR = 3600000;

export function requestedAgo(requestedAt: string): string {
  const elapsedHours = Math.floor((Date.now() - new Date(requestedAt).getTime()) / MS_PER_HOUR);
  if (elapsedHours < 1) return "il y a moins d'une heure";
  if (elapsedHours < 24) return `il y a ${elapsedHours}h`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays === 1) return 'hier';
  return `il y a ${elapsedDays} jours`;
}
