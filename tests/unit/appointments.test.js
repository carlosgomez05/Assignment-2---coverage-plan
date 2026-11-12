import { describe, test, expect } from 'vitest';
import { AppError } from '../../src/errors.js';
import { buildAppointmentService, guestInput, TODAY } from './support/appointmentFakes.js';

// Fixed "now" in these tests is Monday 2026-10-19 12:00 (see support/appointmentFakes.js).

// ---------- Area: Appointment rules ----------
describe('create', () => {
  test('create_GuestBooksFreeSlot_ReturnsBookedAppointmentEndingThirtyMinutesLater', () => {
    // Arrange
    const { service } = buildAppointmentService();
    const input = guestInput({ start: '10:00' });

    // Act
    const appt = service.create(null, input);

    // Assert
    expect({ status: appt.status, start: appt.start, end: appt.end }).toEqual({
      status: 'booked',
      start: '10:00',
      end: '10:30',
    });
  });

  // README A7: "Past times cannot be booked". Interpretation: a slot that starts at the current instant
  // has already started, so it is not bookable.
  test('create_SlotStartsExactlyNow_ThrowsInThePast', () => {
    // Arrange
    const { service } = buildAppointmentService({ now: new Date(`${TODAY}T12:00:00`) });

    // Act
    const act = () => service.create(null, guestInput({ date: TODAY, start: '12:00' }));

    // Assert
    expect(act).toThrow(AppError);
    expect(act).toThrow(expect.objectContaining({ code: 'IN_THE_PAST' }));
  });

  // Requirement: invalid input is rejected with a 400 "bad request", not an unhandled crash.
  test('create_MissingRequestBody_ThrowsBadRequestNotTypeError', () => {
    // Arrange
    const { service } = buildAppointmentService();

    // Act
    const act = () => service.create(null, undefined);

    // Assert
    expect(act).toThrow(AppError);
    expect(act).toThrow(expect.objectContaining({ status: 400 }));
  });
});

describe('cancel', () => {
  test('cancel_GuestWithCorrectManageToken_ReturnsCancelledAppointment', () => {
    // Arrange
    const { service } = buildAppointmentService();
    const booked = service.create(null, guestInput());

    // Act
    const result = service.cancel(null, booked.id, booked.manageToken);

    // Assert
    expect(result.status).toBe('cancelled');
  });

  // Interpretation: cancelling an already cancelled appointment is a harmless no-op, not an error.
  test('cancel_AlreadyCancelledAppointment_StaysCancelledWithoutError', () => {
    // Arrange
    const { service } = buildAppointmentService();
    const booked = service.create(null, guestInput());
    service.cancel(null, booked.id, booked.manageToken);

    // Act
    const result = service.cancel(null, booked.id, booked.manageToken);

    // Assert
    expect(result.status).toBe('cancelled');
  });

  test('cancel_GuestWithWrongManageToken_ThrowsForbidden', () => {
    // Arrange
    const { service } = buildAppointmentService();
    const booked = service.create(null, guestInput());

    // Act
    const act = () => service.cancel(null, booked.id, 'wrong-token');

    // Assert
    expect(act).toThrow(AppError);
    expect(act).toThrow(expect.objectContaining({ status: 403 }));
  });
});