import { describe, it, expect } from 'vitest';
import { createServices } from '../../src/container.js';
import { createMemoryStore } from '../../src/repositories/memoryStore.js';
import { randomUUID } from 'node:crypto';

// Appointment rules: create, update and cancel.
// Expected results come from the requirements (docs/ARCHITECTURE.md assumptions
// A1-A8 and the API contract), not from reading the code under test.

// 2026-10-19 is a Monday (weekday 1 in the provider's weekly hours).
const MONDAY = '2026-10-19';

const mondayProvider = (id = 'p1', slotMinutes = 30) => ({
  id,
  name: 'Alex',
  title: 'Stylist',
  slotMinutes,
  weeklyHours: { 1: [{ start: '09:00', end: '17:00' }] },
});

const patron = (id = 'u1', name = 'Pat', email = 'pat@test.com') => ({ id, name, email, role: 'patron' });

const provider = (providerId) => ({
  id: 'u-prov',
  name: 'Alex',
  email: 'alex@salon.test',
  role: 'provider',
  providerId,
});

const endOf = (start, minutes) => {
  const [h, m] = start.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

const seedBooked = (store, { providerId, date, start, patronId = null, status = 'booked', manageToken }) =>
  store.appointments.insert({
    id: randomUUID(),
    providerId,
    date,
    start,
    end: endOf(start, 30),
    attendeeName: 'Someone',
    contactEmail: 'someone@test.com',
    patronId,
    bookedBy: patronId ? 'patron' : 'anonymous',
    status,
    manageToken: manageToken ?? `token-${randomUUID()}`,
    createdAt: new Date().toISOString(),
  });

// Fixed clock; every test builds its own store and services so no test can affect another.
const makeServices = ({ now = '2026-10-19T08:00:00', requireRegistration = false } = {}) => {
  const store = createMemoryStore();
  if (requireRegistration) store.settings.update({ requireRegistration: true });
  const services = createServices({ store, clock: () => new Date(now) });
  return { store, services };
};

// Returns the error a call throws, or fails the test if the call succeeds.
const errorFrom = (fn) => {
  try {
    fn();
  } catch (err) {
    return err;
  }
  throw new Error('expected an error to be thrown, but none was');
};

describe('appointments.create', () => {
  it('create_validFutureSlot_returnsBookedAppointment', () => {
    // Arrange
    const { store, services } = makeServices();
    store.providers.insert(mondayProvider());

    // Act
    const result = services.appointments.create(patron(), { providerId: 'p1', date: MONDAY, start: '09:00' });

    // Assert
    expect(result.status).toBe('booked');
    expect(result.start).toBe('09:00');
    expect(result.end).toBe('09:30');
    expect(result.patronId).toBe('u1');
    expect(result.manageToken).toBeTruthy();
  });

  it('create_bookingExactlyAtCurrentTime_throwsInThePast', () => {
    // Arrange
    const { store, services } = makeServices({ now: '2026-10-19T09:00:00' });
    store.providers.insert(mondayProvider());

    // Act
    const err = errorFrom(() =>
      services.appointments.create(patron(), { providerId: 'p1', date: MONDAY, start: '09:00' }),
    );

    // Assert
    expect(err.status).toBe(400);
    expect(err.code).toBe('IN_THE_PAST');
    expect(err.message).toBe('cannot book a time in the past');
  });

  it('create_bookingThirtyMinutesAhead_returnsBookedAppointment', () => {
    // Arrange
    const { store, services } = makeServices({ now: '2026-10-19T08:30:00' });
    store.providers.insert(mondayProvider());

    // Act
    const result = services.appointments.create(patron(), { providerId: 'p1', date: MONDAY, start: '09:00' });

    // Assert
    expect(result.status).toBe('booked');
    expect(result.start).toBe('09:00');
  });

  it('create_slotAlreadyBooked_throwsSlotTaken', () => {
    // Arrange
    const { store, services } = makeServices();
    store.providers.insert(mondayProvider());
    seedBooked(store, { providerId: 'p1', date: MONDAY, start: '09:00' });

    // Act
    const err = errorFrom(() =>
      services.appointments.create(patron(), { providerId: 'p1', date: MONDAY, start: '09:00' }),
    );

    // Assert
    expect(err.status).toBe(409);
    expect(err.code).toBe('SLOT_TAKEN');
    expect(err.message).toBe('that slot has just been taken');
  });

  it('create_anonymousWhenRegistrationRequired_throwsRegistrationRequired', () => {
    // Arrange
    const { store, services } = makeServices({ requireRegistration: true });
    store.providers.insert(mondayProvider());

    // Act
    const err = errorFrom(() =>
      services.appointments.create(null, {
        providerId: 'p1',
        date: MONDAY,
        start: '09:00',
        attendeeName: 'Warren',
        contactEmail: 'warren@test.com',
      }),
    );

    // Assert
    expect(err.status).toBe(401);
    expect(err.code).toBe('REGISTRATION_REQUIRED');
    expect(err.message).toBe('this vendor requires you to register before booking');
  });

  it('create_invalidDateFormat_throwsBadRequest', () => {
    // Arrange
    const { store, services } = makeServices();
    store.providers.insert(mondayProvider());

    // Act
    const err = errorFrom(() =>
      services.appointments.create(patron(), { providerId: 'p1', date: '19/10/2026', start: '09:00' }),
    );

    // Assert
    expect(err.status).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
    expect(err.message).toBe('date must be YYYY-MM-DD');
  });

  it('create_providerOnAnotherProvidersCalendar_throwsForbidden', () => {
    // Arrange
    const { store, services } = makeServices();
    store.providers.insert(mondayProvider());

    // Act
    const err = errorFrom(() =>
      services.appointments.create(provider('p2'), { providerId: 'p1', date: MONDAY, start: '09:00' }),
    );

    // Assert
    expect(err.status).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
    expect(err.message).toBe('providers can only book on their own calendar');
  });

  it('create_patronWithoutContactEmail_throwsBadRequest', () => {
    // Arrange
    const { store, services } = makeServices();
    store.providers.insert(mondayProvider());

    // Act
    const err = errorFrom(() =>
      services.appointments.create(patron('u1', 'Pat', ''), { providerId: 'p1', date: MONDAY, start: '09:00' }),
    );

    // Assert
    expect(err.status).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
    expect(err.message).toBe('a valid contactEmail is required');
  });

  it('create_missingAttendeeName_throwsBadRequest', () => {
    // Arrange
    const { store, services } = makeServices();
    store.providers.insert(mondayProvider());

    // Act
    const err = errorFrom(() =>
      services.appointments.create(patron('u1', '', 'pat@test.com'), {
        providerId: 'p1',
        date: MONDAY,
        start: '09:00',
      }),
    );

    // Assert
    expect(err.status).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
    expect(err.message).toBe('attendeeName is required');
  });

  it('create_providerWalkInWithoutContactEmail_returnsBookedAppointment', () => {
    // Arrange
    const { store, services } = makeServices();
    store.providers.insert(mondayProvider());

    // Act
    const result = services.appointments.create(provider('p1'), {
      providerId: 'p1',
      date: MONDAY,
      start: '09:00',
      attendeeName: 'Walk-in',
    });

    // Assert
    expect(result.status).toBe('booked');
    expect(result.contactEmail).toBe('alex@salon.test');
    expect(result.bookedBy).toBe('provider');
  });
});

describe('appointments.update', () => {
  it('update_rescheduleToFreeSlot_returnsNewSlotTimes', () => {
    // Arrange
    const { store, services } = makeServices();
    store.providers.insert(mondayProvider());
    const appt = seedBooked(store, { providerId: 'p1', date: MONDAY, start: '09:00', patronId: 'u1' });

    // Act
    const result = services.appointments.update(patron('u1'), appt.id, { start: '10:00' });

    // Assert
    expect(result.start).toBe('10:00');
    expect(result.end).toBe('10:30');
    expect(result.status).toBe('booked');
  });

  it('update_cancelledAppointment_throwsAlreadyCancelled', () => {
    // Arrange
    const { store, services } = makeServices();
    store.providers.insert(mondayProvider());
    const appt = seedBooked(store, {
      providerId: 'p1',
      date: MONDAY,
      start: '09:00',
      patronId: 'u1',
      status: 'cancelled',
    });

    // Act
    const err = errorFrom(() => services.appointments.update(patron('u1'), appt.id, { start: '10:00' }));

    // Assert
    expect(err.status).toBe(409);
    expect(err.code).toBe('ALREADY_CANCELLED');
    expect(err.message).toBe('cancelled appointments cannot be changed');
  });

  it('update_rescheduleIntoTakenSlot_throwsSlotTaken', () => {
    // Arrange
    const { store, services } = makeServices();
    store.providers.insert(mondayProvider());
    const appt = seedBooked(store, { providerId: 'p1', date: MONDAY, start: '09:00', patronId: 'u1' });
    seedBooked(store, { providerId: 'p1', date: MONDAY, start: '10:00', patronId: 'u2' });

    // Act
    const err = errorFrom(() => services.appointments.update(patron('u1'), appt.id, { start: '10:00' }));

    // Assert
    expect(err.status).toBe(409);
    expect(err.code).toBe('SLOT_TAKEN');
    expect(err.message).toBe('that slot has just been taken');
  });

  it('update_emptyAttendeeName_throwsBadRequest', () => {
    // Arrange
    const { store, services } = makeServices();
    store.providers.insert(mondayProvider());
    const appt = seedBooked(store, { providerId: 'p1', date: MONDAY, start: '09:00', patronId: 'u1' });

    // Act
    const err = errorFrom(() => services.appointments.update(patron('u1'), appt.id, { attendeeName: '   ' }));

    // Assert
    expect(err.status).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
    expect(err.message).toBe('attendeeName cannot be empty');
  });

  it('update_invalidContactEmail_throwsBadRequest', () => {
    // Arrange
    const { store, services } = makeServices();
    store.providers.insert(mondayProvider());
    const appt = seedBooked(store, { providerId: 'p1', date: MONDAY, start: '09:00', patronId: 'u1' });

    // Act
    const err = errorFrom(() => services.appointments.update(patron('u1'), appt.id, { contactEmail: 'not-an-email' }));

    // Assert
    expect(err.status).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
    expect(err.message).toBe('a valid contactEmail is required');
  });

  it('update_nonOwnerActor_throwsForbidden', () => {
    // Arrange
    const { store, services } = makeServices();
    store.providers.insert(mondayProvider());
    const appt = seedBooked(store, { providerId: 'p1', date: MONDAY, start: '09:00', patronId: 'u1' });

    // Act
    const err = errorFrom(() => services.appointments.update(patron('u2'), appt.id, { start: '10:00' }));

    // Assert
    expect(err.status).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
    expect(err.message).toBe('you cannot manage this appointment');
  });

  it('update_noChanges_keepsExistingBooking', () => {
    // Arrange
    const { store, services } = makeServices();
    store.providers.insert(mondayProvider());
    const appt = seedBooked(store, { providerId: 'p1', date: MONDAY, start: '09:00', patronId: 'u1' });

    // Act
    const result = services.appointments.update(patron('u1'), appt.id, {});

    // Assert
    expect(result.start).toBe('09:00');
    expect(result.end).toBe('09:30');
    expect(result.updatedAt).toBeTruthy();
  });

  it('update_unknownAppointmentId_throwsNotFound', () => {
    // Arrange
    const { store, services } = makeServices();
    store.providers.insert(mondayProvider());

    // Act
    const err = errorFrom(() => services.appointments.update(patron('u1'), 'no-such-id', {}));

    // Assert
    expect(err.status).toBe(404);
    expect(err.code).toBe('APPOINTMENT_NOT_FOUND');
    expect(err.message).toBe('appointment not found');
  });
});

describe('appointments.cancel', () => {
  it('cancel_bookedAppointment_returnsCancelledStatus', () => {
    // Arrange
    const { store, services } = makeServices();
    store.providers.insert(mondayProvider());
    const appt = seedBooked(store, { providerId: 'p1', date: MONDAY, start: '09:00', patronId: 'u1' });

    // Act
    const result = services.appointments.cancel(patron('u1'), appt.id);

    // Assert
    expect(result.status).toBe('cancelled');
    expect(result.cancelledBy).toBe('patron');
    expect(result.cancelledAt).toBeTruthy();
  });

  // Interpretation: cancelling an appointment that is already cancelled is a no-op,
  // not an error (assumption A6 keeps cancelled records for history).
  it('cancel_alreadyCancelledAppointment_returnsCancelledWithoutError', () => {
    // Arrange
    const { store, services } = makeServices();
    store.providers.insert(mondayProvider());
    const appt = seedBooked(store, {
      providerId: 'p1',
      date: MONDAY,
      start: '09:00',
      patronId: 'u1',
      status: 'cancelled',
    });

    // Act
    const result = services.appointments.cancel(patron('u1'), appt.id);

    // Assert
    expect(result.status).toBe('cancelled');
  });

  it('cancel_nonOwnerActor_throwsForbidden', () => {
    // Arrange
    const { store, services } = makeServices();
    store.providers.insert(mondayProvider());
    const appt = seedBooked(store, { providerId: 'p1', date: MONDAY, start: '09:00', patronId: 'u1' });

    // Act
    const err = errorFrom(() => services.appointments.cancel(patron('u2'), appt.id));

    // Assert
    expect(err.status).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
    expect(err.message).toBe('you cannot manage this appointment');
  });

  it('cancel_providerCancelsOwnCalendarBooking_returnsCancelledStatus', () => {
    // Arrange
    const { store, services } = makeServices();
    store.providers.insert(mondayProvider());
    const appt = seedBooked(store, { providerId: 'p1', date: MONDAY, start: '09:00' });

    // Act
    const result = services.appointments.cancel(provider('p1'), appt.id);

    // Assert
    expect(result.status).toBe('cancelled');
    expect(result.cancelledBy).toBe('provider');
  });

  it('cancel_withManageToken_returnsCancelledStatus', () => {
    // Arrange
    const { store, services } = makeServices();
    store.providers.insert(mondayProvider());
    const appt = seedBooked(store, { providerId: 'p1', date: MONDAY, start: '09:00', manageToken: 'guest-token' });

    // Act
    const result = services.appointments.cancel(null, appt.id, 'guest-token');

    // Assert
    expect(result.status).toBe('cancelled');
    expect(result.cancelledBy).toBe('anonymous');
  });

  it('cancel_unknownAppointmentId_throwsNotFound', () => {
    // Arrange
    const { store, services } = makeServices();
    store.providers.insert(mondayProvider());

    // Act
    const err = errorFrom(() => services.appointments.cancel(patron('u1'), 'no-such-id'));

    // Assert
    expect(err.status).toBe(404);
    expect(err.code).toBe('APPOINTMENT_NOT_FOUND');
    expect(err.message).toBe('appointment not found');
  });
});
