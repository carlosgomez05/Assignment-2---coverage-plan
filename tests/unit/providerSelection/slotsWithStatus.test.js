// Provider selection, part 2: which of those slots are still free.
// Unit under test: slotsWithStatus() in src/domain/availability.js
import assert from "node:assert/strict";
import { test } from "vitest";
import { slotsWithStatus } from "../../../src/domain/availability.js";

const MONDAY = "2026-03-23";

/** A Monday provider with one window and a chosen slot length. */
function mondayProvider(open, close, slotMinutes) {
  return { slotMinutes, weeklyHours: { 1: [{ start: open, end: close }] } };
}

/** An appointment as the service passes it in: only the times matter to the overlap check. */
function booked(start, end) {
  return { start, end };
}

test("slotsWithStatus_OneOfFourSlotsBooked_FlagsOnlyTheClashingSlot", () => {
  const provider = mondayProvider("09:00", "11:00", 30);

  const slots = slotsWithStatus(provider, MONDAY, [booked("09:30", "10:00")]);

  assert.deepEqual(
    slots.map((s) => s.available),
    [true, false, true, true],
  );
});

test("slotsWithStatus_BookingEndsWhenNextSlotStarts_LeavesNextSlotAvailable", () => {
  // Boundary: back-to-back bookings are allowed, so 09:30-10:00 stays free after 09:00-09:30.
  const provider = mondayProvider("09:00", "11:00", 30);

  const slots = slotsWithStatus(provider, MONDAY, [booked("09:00", "09:30")]);

  assert.equal(slots[1].available, true);
});

test("slotsWithStatus_BookingEndsOneMinuteBeforeNextSlotStarts_LeavesNextSlotAvailable", () => {
  // Boundary: the free slot starts one minute after the booking ends, so it is still free.
  const provider = mondayProvider("09:00", "11:00", 30);

  const slots = slotsWithStatus(provider, MONDAY, [booked("09:00", "09:29")]);

  assert.equal(slots[1].available, true);
});

test("slotsWithStatus_EverySlotBooked_ReturnsAllUnavailable", () => {
  // Valid case at the extreme: a fully booked morning offers nothing.
  const provider = mondayProvider("09:00", "10:00", 30);

  const slots = slotsWithStatus(provider, MONDAY, [booked("09:00", "10:00")]);

  assert.ok(slots.every((s) => s.available === false));
});

test("slotsWithStatus_NoBookings_ReturnsEverySlotAvailable", () => {
  const provider = mondayProvider("09:00", "11:00", 30);

  const slots = slotsWithStatus(provider, MONDAY, []);

  assert.ok(slots.every((s) => s.available === true));
});

test("slotsWithStatus_BookingOverlapsByOneMinute_FlagsBothSlots", () => {
  // Invalid: a booking that spills one minute into the next slot blocks it too.
  const provider = mondayProvider("09:00", "11:00", 30);

  const slots = slotsWithStatus(provider, MONDAY, [booked("09:00", "09:31")]);

  assert.deepEqual(
    slots.map((s) => s.available),
    [false, false, true, true],
  );
});

test("slotsWithStatus_DayTheProviderDoesNotWork_ReturnsNoSlots", () => {
  // Invalid: no grid that day, so nothing to flag.
  const provider = mondayProvider("09:00", "10:00", 30);

  const slots = slotsWithStatus(provider, "2026-03-21", [
    booked("09:00", "09:30"),
  ]);

  assert.deepEqual(slots, []);
});
