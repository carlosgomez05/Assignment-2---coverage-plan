// Provider selection, part 1: which slots a provider can be booked for on a day.
// Unit under test: slotsForDay() in src/domain/availability.js
import assert from "node:assert/strict";
import { test } from "vitest";
import { slotsForDay } from "../../../src/domain/availability.js";

// Monday 23 March 2026 is weekday 1; Saturday 21 March is weekday 6.
const MONDAY = "2026-03-23";
const SATURDAY = "2026-03-21";

/** A provider who works one window on one weekday, with the other days closed. */
function providerWithHours(day, open, close, slotMinutes) {
  return {
    slotMinutes,
    weeklyHours: { [String(day)]: [{ start: open, end: close }] },
  };
}

test("slotsForDay_NineToElevenInHalfHours_ReturnsFourSlotsEndingAtEleven", () => {
  const provider = providerWithHours(1, "09:00", "11:00", 30);

  const slots = slotsForDay(provider, MONDAY);

  assert.deepEqual(slots, [
    { start: "09:00", end: "09:30" },
    { start: "09:30", end: "10:00" },
    { start: "10:00", end: "10:30" },
    { start: "10:30", end: "11:00" },
  ]);
});

test("slotsForDay_WindowExactlyOneSlotLong_ReturnsOneSlot", () => {
  // Boundary: 09:00-09:45 holds exactly one 45-minute slot.
  const provider = providerWithHours(1, "09:00", "09:45", 45);

  const slots = slotsForDay(provider, MONDAY);

  assert.deepEqual(slots, [{ start: "09:00", end: "09:45" }]);
});

test("slotsForDay_WindowShorterThanOneSlot_ReturnsNoSlots", () => {
  // Boundary: 09:00-09:35 cannot hold a whole 45-minute slot.
  const provider = providerWithHours(1, "09:00", "09:35", 45);

  const slots = slotsForDay(provider, MONDAY);

  assert.deepEqual(slots, []);
});

test("slotsForDay_ZeroLengthWindow_ReturnsNoSlots", () => {
  // Invalid: a window that opens and closes at the same minute offers nothing.
  const provider = providerWithHours(1, "09:00", "09:00", 30);

  const slots = slotsForDay(provider, MONDAY);

  assert.deepEqual(slots, []);
});

test("slotsForDay_ProviderNotWorkingThatDay_ReturnsNoSlots", () => {
  // Invalid: Alex works Monday only, so Saturday has no slots.
  const provider = providerWithHours(1, "09:00", "17:00", 30);

  const slots = slotsForDay(provider, SATURDAY);

  assert.deepEqual(slots, []);
});

test("slotsForDay_UnlistedDay_ReturnsNoSlots", () => {
  // Invalid: a provider with an empty schedule has no slots on any day.
  const provider = { slotMinutes: 30, weeklyHours: {} };

  const slots = slotsForDay(provider, MONDAY);

  assert.deepEqual(slots, []);
});

test("slotsForDay_BookingCountedAcrossMidnight_DoesNotWrapPastClosingTime", () => {
  // No slot may extend past closing time, whatever the slot length.
  const provider = providerWithHours(1, "23:00", "23:59", 60);

  const slots = slotsForDay(provider, MONDAY);

  assert.deepEqual(slots, []);
});
