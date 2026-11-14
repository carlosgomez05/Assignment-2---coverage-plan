import { describe, expect, it } from 'vitest';
import { slotsForDay } from '../../src/domain/availability.js';
import { MONDAY, SUNDAY, makeProvider } from './support/fakes.js';

// Availability + block durations: a provider offers back-to-back slots of their chosen
// length inside each working window; a slot that would run past closing time is not offered.
describe('slotsForDay', () => {
  it('slotsForDay_ThirtyMinuteSlotsOneHourWindow_ReturnsTwoSlots', () => {
    const provider = makeProvider({ weeklyHours: { 1: [{ start: '09:00', end: '10:00' }] } });

    const result = slotsForDay(provider, MONDAY);

    expect(result).toEqual([
      { start: '09:00', end: '09:30' },
      { start: '09:30', end: '10:00' },
    ]);
  });

  it('slotsForDay_DayWithNoWorkingHours_ReturnsEmpty', () => {
    const provider = makeProvider();

    const result = slotsForDay(provider, SUNDAY);

    expect(result).toHaveLength(0);
  });

  it('slotsForDay_LastSlotEndsExactlyAtClosing_IncludesThatSlot', () => {
    const provider = makeProvider({ weeklyHours: { 1: [{ start: '16:00', end: '17:00' }] } });

    const result = slotsForDay(provider, MONDAY);

    expect(result.at(-1)).toEqual({ start: '16:30', end: '17:00' });
  });

  it('slotsForDay_SlotWouldEndOneMinutePastClosing_ExcludesThatSlot', () => {
    const provider = makeProvider({ slotMinutes: 31, weeklyHours: { 1: [{ start: '16:00', end: '17:00' }] } });

    const result = slotsForDay(provider, MONDAY);

    expect(result).toEqual([{ start: '16:00', end: '16:31' }]);
  });
});
