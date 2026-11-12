import { beforeEach, describe, expect, it } from 'vitest';
import { createAppointmentService } from '../../src/services/appointmentService.js';
import { MONDAY, at, createFakeStore, fixedClock, makeProvider } from './support/fakes.js';

// Gap tests added after merging: update (reschedule / edit details), get and list were not covered.
// Requirements used: rescheduling frees the old slot; cancelled appointments cannot be changed;
// only the owner, the provider or the manage-token holder can see or change an appointment.
const NOW = at(2030, 1, 1, 12, 0);
const provider = makeProvider();
const patron = { id: 'pat-1', name: 'Pat Patron', email: 'pat@example.com', role: 'patron', providerId: null };
const otherPatron = { id: 'pat-2', name: 'Other', email: 'other@example.com', role: 'patron', providerId: null };
const providerActor = { id: 'usr-p', name: 'Alex', email: 'alex@example.com', role: 'provider', providerId: provider.id };

let service;
const book = (start = '10:00', actor = patron) => service.create(actor, { providerId: provider.id, date: MONDAY, start });

beforeEach(() => {
  const store = createFakeStore();
  service = createAppointmentService({
    store,
    providers: { get: () => provider },
    settings: { get: () => store.settings.get() },
    clock: fixedClock(NOW),
  });
});

describe('updateAppointment', () => {
  it('update_RescheduleToOpenSlot_MovesAndFreesOldSlot', () => {
    const appt = book('10:00');

    const moved = service.update(patron, appt.id, { start: '11:00' });

    expect(moved).toMatchObject({ start: '11:00', end: '11:30' });
    expect(book('10:00').status).toBe('booked');
  });

  it('update_RescheduleOntoTakenSlot_ThrowsSlotTaken', () => {
    const appt = book('10:00');
    book('11:00', otherPatron);

    expect(() => service.update(patron, appt.id, { start: '11:00' })).toThrowError(
      expect.objectContaining({ status: 409, code: 'SLOT_TAKEN' }),
    );
  });

  it('update_SameSlotAsItself_DoesNotConflictWithItself', () => {
    const appt = book('10:00');

    const result = service.update(patron, appt.id, { start: '10:00', attendeeName: 'New Name' });

    expect(result).toMatchObject({ start: '10:00', attendeeName: 'New Name' });
  });

  it('update_CancelledAppointment_ThrowsAlreadyCancelled', () => {
    const appt = book('10:00');
    service.cancel(patron, appt.id);

    expect(() => service.update(patron, appt.id, { start: '11:00' })).toThrowError(
      expect.objectContaining({ status: 409, code: 'ALREADY_CANCELLED' }),
    );
  });

  it('update_WhitespaceAttendeeName_ThrowsBadRequest', () => {
    const appt = book('10:00');

    expect(() => service.update(patron, appt.id, { attendeeName: '   ' })).toThrowError(
      expect.objectContaining({ status: 400 }),
    );
  });

  it('update_InvalidEmail_ThrowsBadRequest', () => {
    const appt = book('10:00');

    expect(() => service.update(patron, appt.id, { contactEmail: 'not-an-email' })).toThrowError(
      expect.objectContaining({ status: 400 }),
    );
  });

  it('update_ValidEmail_IsStoredLowercase', () => {
    const appt = book('10:00');

    expect(service.update(patron, appt.id, { contactEmail: 'New@Example.COM' }).contactEmail).toBe('new@example.com');
  });

  it('update_ByStrangerWithoutToken_ThrowsForbidden', () => {
    const appt = book('10:00');

    expect(() => service.update(otherPatron, appt.id, { start: '11:00' })).toThrowError(
      expect.objectContaining({ status: 403 }),
    );
  });

  it('update_AnonymousWithManageToken_IsAllowed', () => {
    const appt = book('10:00');

    expect(service.update(null, appt.id, { start: '11:00' }, appt.manageToken).start).toBe('11:00');
  });

  it('update_UnknownId_ThrowsNotFound', () => {
    expect(() => service.update(patron, 'nope', {})).toThrowError(
      expect.objectContaining({ status: 404, code: 'APPOINTMENT_NOT_FOUND' }),
    );
  });
});

describe('getAppointment', () => {
  it('get_ByOwner_ReturnsAppointmentWithoutManageToken', () => {
    const appt = book('10:00');

    const result = service.get(patron, appt.id);

    expect(result.id).toBe(appt.id);
    expect(result.manageToken).toBeUndefined();
  });

  it('get_ByOtherPatron_ThrowsForbidden', () => {
    const appt = book('10:00');

    expect(() => service.get(otherPatron, appt.id)).toThrowError(expect.objectContaining({ status: 403 }));
  });
});

describe('listAppointments', () => {
  it('list_Anonymous_ThrowsUnauthorized', () => {
    expect(() => service.list(null)).toThrowError(expect.objectContaining({ status: 401 }));
  });

  it('list_Patron_SeesOnlyOwnBookingsSortedByTime', () => {
    book('11:00');
    book('09:00');
    book('10:00', otherPatron);

    expect(service.list(patron).map((a) => a.start)).toEqual(['09:00', '11:00']);
  });

  it('list_Provider_SeesWholeCalendarFilteredByStatus', () => {
    const a = book('09:00');
    book('10:00', otherPatron);
    service.cancel(patron, a.id);

    expect(service.list(providerActor, { status: 'booked' }).map((x) => x.start)).toEqual(['10:00']);
  });
});
