import { beforeEach, describe, expect, it } from 'vitest';
import { createAppointmentService } from '../../src/services/appointmentService.js';
import { MONDAY, at, createFakeStore, fixedClock, makeProvider } from './support/fakes.js';

// Appointment rules, booking for others, and registration-required setting.
// Requirements used: past times cannot be booked (A7); a slot can hold one active booking;
// only 'booked' appointments block time (A6); anonymous booking allowed unless the vendor
// requires registration; patrons may book for another person by giving an attendee name.
const NOW = at(2030, 1, 1, 12, 0);
const provider = makeProvider();
const patron = { id: 'pat-1', name: 'Pat Patron', email: 'pat@example.com', role: 'patron', providerId: null };

let store;
let service;

const build = ({ requireRegistration = false, now = NOW } = {}) => {
  store = createFakeStore({ requireRegistration });
  service = createAppointmentService({
    store,
    providers: { get: () => provider },
    settings: { get: () => store.settings.get() },
    clock: fixedClock(now),
  });
};

const request = (overrides = {}) => ({ providerId: provider.id, date: MONDAY, start: '10:00', ...overrides });

describe('createAppointment', () => {
  beforeEach(() => build());

  it('create_PatronBooksOpenSlot_ReturnsBookedAppointmentWithSlotEnd', () => {
    const result = service.create(patron, request());

    expect(result).toMatchObject({ status: 'booked', start: '10:00', end: '10:30', patronId: 'pat-1' });
  });

  it('create_PatronBooksForSomeoneElse_StoresAttendeeNameAndPatronAsBooker', () => {
    const result = service.create(patron, request({ attendeeName: '  Sam Guest ' }));

    expect(result).toMatchObject({ attendeeName: 'Sam Guest', patronId: 'pat-1' });
  });

  it('create_GuestBooksWithNameAndEmail_ReturnsManageToken', () => {
    const result = service.create(null, request({ attendeeName: 'Gus', contactEmail: 'gus@example.com' }));

    expect(result.manageToken).toBeTruthy();
  });

  it('create_SlotStartsOneMinuteAfterNow_IsAccepted', () => {
    build({ now: at(2030, 1, 7, 9, 59) });

    const result = service.create(patron, request({ start: '10:00' }));

    expect(result.status).toBe('booked');
  });

  // Interpretation: a slot that starts at the current instant can no longer be booked.
  it('create_SlotStartsExactlyNow_ThrowsInThePast', () => {
    build({ now: at(2030, 1, 7, 10, 0) });

    const act = () => service.create(patron, request({ start: '10:00' }));

    expect(act).toThrowError(expect.objectContaining({ code: 'IN_THE_PAST' }));
  });

  it('create_SlotStartedOneMinuteAgo_ThrowsInThePast', () => {
    build({ now: at(2030, 1, 7, 10, 1) });

    const act = () => service.create(patron, request({ start: '10:00' }));

    expect(act).toThrowError(expect.objectContaining({ code: 'IN_THE_PAST' }));
  });

  it('create_SlotAlreadyBooked_ThrowsSlotTaken', () => {
    service.create(patron, request());

    const act = () => service.create(patron, request());

    expect(act).toThrowError(expect.objectContaining({ code: 'SLOT_TAKEN' }));
  });

  it('create_AdjacentSlotToBookedOne_IsAccepted', () => {
    service.create(patron, request({ start: '10:00' }));

    const result = service.create(patron, request({ start: '10:30' }));

    expect(result.status).toBe('booked');
  });

  it('create_SlotPreviouslyCancelled_IsAcceptedAgain', () => {
    const first = service.create(patron, request());
    service.cancel(patron, first.id);

    const result = service.create(patron, request());

    expect(result.status).toBe('booked');
  });

  it('create_TimeNotOnProviderGrid_ThrowsNotASlot', () => {
    const act = () => service.create(patron, request({ start: '10:15' }));

    expect(act).toThrowError(expect.objectContaining({ code: 'NOT_A_SLOT' }));
  });

  it('create_MalformedDate_ThrowsBadRequest', () => {
    const act = () => service.create(patron, request({ date: '2030-02-30' }));

    expect(act).toThrowError(expect.objectContaining({ status: 400 }));
  });

  it('create_GuestWhenRegistrationRequired_ThrowsRegistrationRequired', () => {
    build({ requireRegistration: true });

    const act = () => service.create(null, request({ attendeeName: 'Gus', contactEmail: 'gus@example.com' }));

    expect(act).toThrowError(expect.objectContaining({ code: 'REGISTRATION_REQUIRED' }));
  });

  it('create_PatronWhenRegistrationRequired_IsAccepted', () => {
    build({ requireRegistration: true });

    const result = service.create(patron, request());

    expect(result.status).toBe('booked');
  });

  it('create_GuestWithInvalidEmail_ThrowsBadRequest', () => {
    const act = () => service.create(null, request({ attendeeName: 'Gus', contactEmail: 'not-an-email' }));

    expect(act).toThrowError(expect.objectContaining({ status: 400 }));
  });

  it('create_GuestWithBlankName_ThrowsBadRequest', () => {
    const act = () => service.create(null, request({ attendeeName: '   ', contactEmail: 'gus@example.com' }));

    expect(act).toThrowError(expect.objectContaining({ status: 400 }));
  });

  it('create_RequestBodyMissing_ThrowsBadRequest', () => {
    const act = () => service.create(patron, undefined);

    expect(act).toThrowError(expect.objectContaining({ status: 400 }));
  });

  it('create_ProviderBooksOnAnotherProvidersCalendar_ThrowsForbidden', () => {
    const other = { id: 'u2', name: 'Sam', role: 'provider', providerId: 'prov-2' };

    const act = () => service.create(other, request({ attendeeName: 'Walk-in' }));

    expect(act).toThrowError(expect.objectContaining({ status: 403 }));
  });
});

describe('cancelAppointment', () => {
  let booked;

  beforeEach(() => {
    build();
    booked = service.create(patron, request());
  });

  it('cancel_OwnerCancelsBookedAppointment_StatusBecomesCancelled', () => {
    const result = service.cancel(patron, booked.id);

    expect(result.status).toBe('cancelled');
  });

  it('cancel_OwnerCancels_RecordsCancellationTimeFromClock', () => {
    const result = service.cancel(patron, booked.id);

    expect(result.cancelledAt).toBe(NOW.toISOString());
  });

  it('cancel_GuestWithCorrectManageToken_StatusBecomesCancelled', () => {
    const guestBooking = service.create(null, request({ start: '11:00', attendeeName: 'Gus', contactEmail: 'g@example.com' }));

    const result = service.cancel(null, guestBooking.id, guestBooking.manageToken);

    expect(result.status).toBe('cancelled');
  });

  it('cancel_ProviderOfTheAppointment_StatusBecomesCancelled', () => {
    const owner = { id: 'u1', name: 'Alex', role: 'provider', providerId: provider.id };

    const result = service.cancel(owner, booked.id);

    expect(result.status).toBe('cancelled');
  });

  it('cancel_AnotherPatron_ThrowsForbidden', () => {
    const stranger = { ...patron, id: 'pat-2' };

    const act = () => service.cancel(stranger, booked.id);

    expect(act).toThrowError(expect.objectContaining({ status: 403 }));
  });

  it('cancel_GuestWithWrongManageToken_ThrowsForbidden', () => {
    const act = () => service.cancel(null, booked.id, 'wrong-token');

    expect(act).toThrowError(expect.objectContaining({ status: 403 }));
  });

  it('cancel_UnknownAppointmentId_ThrowsNotFound', () => {
    const act = () => service.cancel(patron, 'does-not-exist');

    expect(act).toThrowError(expect.objectContaining({ code: 'APPOINTMENT_NOT_FOUND' }));
  });

  it('cancel_AlreadyCancelledAppointment_RemainsCancelled', () => {
    service.cancel(patron, booked.id);

    const result = service.cancel(patron, booked.id);

    expect(result.status).toBe('cancelled');
  });
});

describe('updateAppointment', () => {
  let booked;

  beforeEach(() => {
    build();
    booked = service.create(patron, request());
  });

  it('update_MoveToFreeSlot_ChangesStartAndEnd', () => {
    const result = service.update(patron, booked.id, { start: '14:00' });

    expect(result).toMatchObject({ start: '14:00', end: '14:30' });
  });

  it('update_MoveToSlotTakenByAnotherBooking_ThrowsSlotTaken', () => {
    service.create(patron, request({ start: '14:00' }));

    const act = () => service.update(patron, booked.id, { start: '14:00' });

    expect(act).toThrowError(expect.objectContaining({ code: 'SLOT_TAKEN' }));
  });

  it('update_MoveToItsOwnCurrentSlot_IsNotReportedAsConflict', () => {
    const result = service.update(patron, booked.id, { start: '10:00', attendeeName: 'Renamed' });

    expect(result.attendeeName).toBe('Renamed');
  });

  it('update_MoveToPastTime_ThrowsInThePast', () => {
    build({ now: at(2030, 1, 7, 12, 0) });
    const todays = service.create(patron, request({ start: '13:00' }));

    const act = () => service.update(patron, todays.id, { start: '11:00' });

    expect(act).toThrowError(expect.objectContaining({ code: 'IN_THE_PAST' }));
  });

  it('update_CancelledAppointment_ThrowsAlreadyCancelled', () => {
    service.cancel(patron, booked.id);

    const act = () => service.update(patron, booked.id, { start: '14:00' });

    expect(act).toThrowError(expect.objectContaining({ code: 'ALREADY_CANCELLED' }));
  });

  it('update_BlankAttendeeName_ThrowsBadRequest', () => {
    const act = () => service.update(patron, booked.id, { attendeeName: '  ' });

    expect(act).toThrowError(expect.objectContaining({ status: 400 }));
  });

  it('update_AnotherPatron_ThrowsForbidden', () => {
    const stranger = { ...patron, id: 'pat-2' };

    const act = () => service.update(stranger, booked.id, { start: '14:00' });

    expect(act).toThrowError(expect.objectContaining({ status: 403 }));
  });
});
