/**
 * Format helpers — turn names, dates, file sizes and counts into the text the app shows.
 */
export const roleLabel = { student: 'Student', educator: 'Educator', admin: 'Admin' } as const;

/** "Dr. Maria Santos" → "MS" */
export function initials(name: string) {
  return name
    .replace(/^(Dr\.|Prof\.)\s*/, '')
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function firstName(name: string) {
  return name.replace(/^(Dr\.|Prof\.)\s*/, '').split(/\s+/)[0] ?? name;
}

const DAY = 86_400_000;
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "3 days ago", "in 5 days", "just now" */
export function relTime(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const say = (n: number, unit: string) => {
    const s = `${n} ${unit}${n === 1 ? '' : 's'}`;
    return diff < 0 ? `${s} ago` : `in ${s}`;
  };
  if (abs < 60_000) return 'just now';
  if (abs < 3_600_000) return say(Math.round(abs / 60_000), 'minute');
  if (abs < DAY) return say(Math.round(abs / 3_600_000), 'hour');
  if (abs < 30 * DAY) return say(Math.round(abs / DAY), 'day');
  return fmtDate(iso);
}

/** "Oct 10, 2026" */
export function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** "2026-10-10": notebook dates, set in mono */
export function isoDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "Thu, Oct 31 · 9:00 AM" */
export function fmtDateTime(iso: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-US', { weekday: 'short' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day}, ${months[d.getMonth()]} ${d.getDate()} · ${time}`;
}

export const monthShort = (iso: string) => months[new Date(iso).getMonth()]!;

/** The value a datetime-local input wants, in local time. */
export function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "No. 007": every work is a numbered notebook entry */
export const entryNo = (id: number) => `No. ${String(id).padStart(3, '0')}`;

export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
