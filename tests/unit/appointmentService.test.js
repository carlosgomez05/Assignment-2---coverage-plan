import { beforeEach, describe, expect, it } from 'vitest';
import { createAppointmentService } from '../../src/services/appointmentService.js';
import { MONDAY, at, createFakeStore, fixedClock, makeProvider } from './support/fakes.js';

// Appointment rules. Requirements used: past times cannot be booked (A7); a patron may
// book for another person via attendeeName; only the owner, the provider or the holder of the
// manage token may cancel an appointment.
const NOW = at(2030, 1, 1, 12, 0);
const provider = makeProvider();
const patron = { id: 'pat-1', name: 'Pat Patron', email: 'pat@example.com', role: 'patron', providerId: null };

let service;

const build = (now = NOW) => {
  const store = createFakeStore();
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

  it('create_PatronBooksOpenSlotForSomeoneElse_StoresAttendeeNameAndSlotEnd', () => {
    const result = service.create(patron, request({ attendeeName: 'Sam Guest' }));

    expect(result).toMatchObject({ status: 'booked', attendeeName: 'Sam Guest', start: '10:00', end: '10:30' });
  });

  it('create_SlotStartsOneMinuteAfterNow_IsAccepted', () => {
    build(at(2030, 1, 7, 9, 59));

    const result = service.create(patron, request({ start: '10:00' }));

    expect(result.status).toBe('booked');
  });

  it('create_SlotStartedOneMinuteAgo_ThrowsInThePast', () => {
    build(at(2030, 1, 7, 10, 1));

    const act = () => service.create(patron, request({ start: '10:00' }));

    expect(act).toThrowError(expect.objectContaining({ code: 'IN_THE_PAST' }));
  });

  it('create_RequestBodyMissing_ThrowsBadRequest', () => {
    const act = () => service.create(patron, undefined);

    expect(act).toThrowError(expect.objectContaining({ status: 400 }));
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

  it('cancel_AnotherPatron_ThrowsForbidden', () => {
    const stranger = { ...patron, id: 'pat-2' };

    const act = () => service.cancel(stranger, booked.id);

    expect(act).toThrowError(expect.objectContaining({ status: 403 }));
  });

  it('cancel_UnknownAppointmentId_ThrowsNotFound', () => {
    const act = () => service.cancel(patron, 'does-not-exist');

    expect(act).toThrowError(expect.objectContaining({ code: 'APPOINTMENT_NOT_FOUND' }));
  });
});
