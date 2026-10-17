// Pure date/time helpers. Dates are "YYYY-MM-DD", times are "HH:MM", both in the
// vendor's local time (assumption A1: one timezone per vendor, no DST handling yet).

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isDate = (d) => {
  if (typeof d !== 'string' || !DATE_RE.test(d)) return false;
  const parsed = new Date(`${d}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(d);
};

export const isTime = (t) => typeof t === 'string' && TIME_RE.test(t);

export const toMinutes = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

export const toHHMM = (mins) =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

// 0 = Sunday ... 6 = Saturday
export const weekday = (date) => new Date(`${date}T00:00:00Z`).getUTCDay();

export const toDateTime = (date, time) => new Date(`${date}T${time}:00`);
