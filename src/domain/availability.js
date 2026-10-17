import { toMinutes, toHHMM, weekday } from './time.js';

// Provider shape used here:
//   { slotMinutes: 30, weeklyHours: { "1": [{ start: "09:00", end: "17:00" }], ... } }
// weeklyHours keys are weekday numbers (0 = Sunday).

export const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

/** Every bookable slot a provider offers on a date, ignoring existing bookings. */
export function slotsForDay(provider, date) {
  const windows = provider.weeklyHours[String(weekday(date))] ?? [];
  const step = provider.slotMinutes;
  const slots = [];
  for (const w of windows) {
    const end = toMinutes(w.end);
    for (let s = toMinutes(w.start); s + step <= end; s += step) {
      slots.push({ start: toHHMM(s), end: toHHMM(s + step) });
    }
  }
  return slots;
}

/** True if [start, end) overlaps any booked appointment ("HH:MM" strings). */
export function hasConflict(booked, start, end) {
  const s = toMinutes(start);
  const e = toMinutes(end);
  return booked.some((b) => overlaps(s, e, toMinutes(b.start), toMinutes(b.end)));
}

/** Slots for a day with an `available` flag, given the provider's active bookings that day. */
export function slotsWithStatus(provider, date, booked) {
  return slotsForDay(provider, date).map((slot) => ({
    ...slot,
    available: !hasConflict(booked, slot.start, slot.end),
  }));
}

/** The slot starting at `start` on that day, or undefined if it is not on the provider's grid. */
export function findSlot(provider, date, start) {
  return slotsForDay(provider, date).find((s) => s.start === start);
}
