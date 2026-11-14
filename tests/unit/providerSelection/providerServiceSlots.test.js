// Provider selection, part 3: the service that answers "what can this provider be
// booked for on this date", including which bookings count.
// Unit under test: createProviderService(...).slots() in src/services/providerService.js
import assert from "node:assert/strict";
import { test } from "vitest";
import { createProviderService } from "../../../src/services/providerService.js";
import { createMemoryStore } from "../../../src/repositories/memoryStore.js";

const MONDAY = "2026-03-23";

/**
 * Builds the real service over the project's in-memory store (a Map behind
 * insert/get/update/where - no database, no network, no web server).
 */
function buildService() {
  const store = createMemoryStore();
  store.providers.insert({
    id: "p-alex",
    name: "Alex",
    title: "Barber",
    slotMinutes: 30,
    weeklyHours: { 1: [{ start: "09:00", end: "11:00" }] },
  });
  return { service: createProviderService({ store }), store };
}

/** A stored appointment; only providerId, date, start, end and status affect the result. */
function appointment(overrides = {}) {
  return {
    id: "a-1",
    providerId: "p-alex",
    date: MONDAY,
    start: "09:30",
    end: "10:00",
    status: "booked",
    ...overrides,
  };
}

test("slots_DateWithNoBookings_ReturnsEverySlotAvailable", () => {
  const { service } = buildService();

  const slots = service.slots("p-alex", MONDAY);

  assert.ok(slots.every((s) => s.available === true));
  assert.equal(slots.length, 4);
});

test("slots_OneSlotBooked_FlagsOnlyThatSlotUnavailable", () => {
  const { service, store } = buildService();
  store.appointments.insert(appointment());

  const slots = service.slots("p-alex", MONDAY);

  assert.deepEqual(
    slots.map((s) => s.start),
    ["09:00", "09:30", "10:00", "10:30"],
  );
  assert.deepEqual(
    slots.map((s) => s.available),
    [true, false, true, true],
  );
});

test("slots_BookingWasCancelled_SlotIsAvailableAgain", () => {
  // Assumption A6: cancelled appointments are kept for history but only booked ones block time.
  const { service, store } = buildService();
  store.appointments.insert(appointment({ status: "cancelled" }));

  const slots = service.slots("p-alex", MONDAY);

  assert.ok(slots.every((s) => s.available === true));
});

test("slots_BookingBelongsToAnotherProvider_IsIgnored", () => {
  // Invalid assumption to guard against: one provider's booking must not block another's calendar.
  const { service, store } = buildService();
  store.appointments.insert(appointment({ providerId: "p-sam" }));

  const slots = service.slots("p-alex", MONDAY);

  assert.ok(slots.every((s) => s.available === true));
});

test("slots_BookingOnAnotherDate_IsIgnored", () => {
  // Invalid: a booking on Tuesday must not block Monday's grid.
  const { service, store } = buildService();
  store.appointments.insert(appointment({ date: "2026-03-24" }));

  const slots = service.slots("p-alex", MONDAY);

  assert.ok(slots.every((s) => s.available === true));
});

test("slots_MalformedDate_ThrowsBadRequest", () => {
  // Invalid: the date must be YYYY-MM-DD.
  const { service } = buildService();

  assert.throws(
    () => service.slots("p-alex", "23-03-2026"),
    (error) => error.status === 400 && error.code === "BAD_REQUEST",
  );
});

test("slots_UnknownProvider_ThrowsNotFound", () => {
  // Invalid: asking for a provider that does not exist is a 404, not an empty list.
  const { service } = buildService();

  assert.throws(
    () => service.slots("p-nobody", MONDAY),
    (error) => error.status === 404 && error.code === "PROVIDER_NOT_FOUND",
  );
});
