import { describe, expect, it } from 'vitest';
import { findSlot, slotsForDay, slotsWithStatus } from '../../src/domain/availability.js';
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

  it('slotsForDay_FullWorkingDayThirtyMinuteSlots_ReturnsSixteenSlots', () => {
    const provider = makeProvider();

    const result = slotsForDay(provider, MONDAY);

    expect(result).toHaveLength(16);
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

  it('slotsForDay_SlotLengthEqualsWindow_ReturnsSingleSlot', () => {
    const provider = makeProvider({ slotMinutes: 60, weeklyHours: { 1: [{ start: '09:00', end: '10:00' }] } });

    const result = slotsForDay(provider, MONDAY);

    expect(result).toEqual([{ start: '09:00', end: '10:00' }]);
  });

  it('slotsForDay_SlotLengthLongerThanWindow_ReturnsEmpty', () => {
    const provider = makeProvider({ slotMinutes: 61, weeklyHours: { 1: [{ start: '09:00', end: '10:00' }] } });

    const result = slotsForDay(provider, MONDAY);

    expect(result).toHaveLength(0);
  });

  it('slotsForDay_SplitShiftWithLunchBreak_OffersNoSlotDuringBreak', () => {
    const provider = makeProvider({
      weeklyHours: { 1: [{ start: '09:00', end: '12:00' }, { start: '13:00', end: '17:00' }] },
    });

    const starts = slotsForDay(provider, MONDAY).map((s) => s.start);

    expect(starts).not.toContain('12:00');
  });
});

describe('findSlot', () => {
  it('findSlot_StartOnProviderGrid_ReturnsThatSlot', () => {
    const provider = makeProvider();

    const result = findSlot(provider, MONDAY, '09:30');

    expect(result).toEqual({ start: '09:30', end: '10:00' });
  });

  it('findSlot_StartBetweenGridPoints_ReturnsUndefined', () => {
    const provider = makeProvider();

    const result = findSlot(provider, MONDAY, '09:15');

    expect(result).toBeUndefined();
  });

  it('findSlot_StartAtClosingTime_ReturnsUndefined', () => {
    const provider = makeProvider();

    const result = findSlot(provider, MONDAY, '17:00');

    expect(result).toBeUndefined();
  });
});

describe('slotsWithStatus', () => {
  it('slotsWithStatus_OneSlotBooked_MarksOnlyThatSlotUnavailable', () => {
    const provider = makeProvider({ weeklyHours: { 1: [{ start: '09:00', end: '10:00' }] } });
    const booked = [{ start: '09:00', end: '09:30' }];

    const result = slotsWithStatus(provider, MONDAY, booked);

    expect(result.map((s) => s.available)).toEqual([false, true]);
  });
});
