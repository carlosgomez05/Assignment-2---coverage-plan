import crypto from 'node:crypto';
import { findSlot, hasConflict } from '../domain/availability.js';
import { isDate, isTime, toDateTime } from '../domain/time.js';
import { badRequest, conflict, forbidden, notFound, unauthorized } from '../errors.js';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

/** Appointment as returned to API callers. The manage token is only shown to whoever created it. */
export const toView = (appt, { includeToken = false } = {}) => {
  const { manageToken, ...rest } = appt;
  return includeToken ? { ...rest, manageToken } : rest;
};

export function createAppointmentService({ store, providers, settings, clock = () => new Date() }) {
  const activeFor = (providerId, date, excludeId) =>
    store.appointments.where(
      (a) => a.providerId === providerId && a.date === date && a.status === 'booked' && a.id !== excludeId,
    );

  /** Shared validation for create and reschedule. Throws if the slot is not bookable. */
  function assertBookable({ providerId, date, start, excludeId }) {
    if (!isDate(date)) throw badRequest('date must be YYYY-MM-DD');
    if (!isTime(start)) throw badRequest('start must be HH:MM');
    const provider = providers.get(providerId);
    const slot = findSlot(provider, date, start);
    if (!slot) throw badRequest('that time is not an available slot for this provider', 'NOT_A_SLOT');
    if (toDateTime(date, start) <= clock()) throw badRequest('cannot book a time in the past', 'IN_THE_PAST');
    // Check-and-insert runs synchronously, so two requests cannot both pass. With a real DB,
    // back this with a unique constraint or transaction (see risk R3 in the strategy).
    if (hasConflict(activeFor(providerId, date, excludeId), slot.start, slot.end)) {
      throw conflict('that slot has just been taken', 'SLOT_TAKEN');
    }
    return slot;
  }

  /** Can this actor manage this appointment? Patron owner, the provider, or holder of the manage token. */
  function assertCanManage(appt, actor, manageToken) {
    const isProvider = actor?.role === 'provider' && actor.providerId === appt.providerId;
    const isOwner = actor?.role === 'patron' && appt.patronId === actor.id;
    const hasToken = Boolean(manageToken) && manageToken === appt.manageToken;
    if (!isProvider && !isOwner && !hasToken) throw forbidden('you cannot manage this appointment');
  }

  const load = (id) => {
    const appt = store.appointments.get(id);
    if (!appt) throw notFound('appointment not found', 'APPOINTMENT_NOT_FOUND');
    return appt;
  };

  return {
    /**
     * input: { providerId, date, start, attendeeName?, contactEmail? }
     * - patron: books for self or for someone else (attendeeName), any provider, any time
     * - provider: books on their own calendar for a walk-in / phone customer
     * - anonymous: allowed unless the vendor requires registration; needs name + email
     */
    create(actor, input) {
      if (!actor && settings.get().requireRegistration) {
        throw unauthorized('this vendor requires you to register before booking', 'REGISTRATION_REQUIRED');
      }
      const { providerId, date, start } = input ?? {};
      if (actor?.role === 'provider' && actor.providerId !== providerId) {
        throw forbidden('providers can only book on their own calendar');
      }

      const attendeeName = (input.attendeeName ?? actor?.name ?? '').trim();
      const contactEmail = (input.contactEmail ?? actor?.email ?? '').trim().toLowerCase();
      if (!attendeeName) throw badRequest('attendeeName is required');
      if (actor?.role !== 'provider' && !EMAIL_RE.test(contactEmail)) {
        throw badRequest('a valid contactEmail is required');
      }

      const slot = assertBookable({ providerId, date, start });
      const appt = {
        id: crypto.randomUUID(),
        providerId,
        date,
        start: slot.start,
        end: slot.end,
        attendeeName,
        contactEmail: contactEmail || null,
        patronId: actor?.role === 'patron' ? actor.id : null,
        bookedBy: actor?.role ?? 'anonymous',
        status: 'booked',
        manageToken: crypto.randomBytes(12).toString('hex'),
        createdAt: clock().toISOString(),
      };
      return toView(store.appointments.insert(appt), { includeToken: true });
    },

    /** Change provider, date/time, or attendee details. Rescheduling frees the old slot automatically. */
    update(actor, id, changes = {}, manageToken) {
      const appt = load(id);
      assertCanManage(appt, actor, manageToken);
      if (appt.status !== 'booked') throw conflict('cancelled appointments cannot be changed', 'ALREADY_CANCELLED');

      const next = {
        providerId: changes.providerId ?? appt.providerId,
        date: changes.date ?? appt.date,
        start: changes.start ?? appt.start,
      };
      const moved = next.providerId !== appt.providerId || next.date !== appt.date || next.start !== appt.start;
      const patch = {};
      if (moved) {
        const slot = assertBookable({ ...next, excludeId: appt.id });
        Object.assign(patch, { ...next, end: slot.end });
      }
      if (changes.attendeeName !== undefined) {
        if (!String(changes.attendeeName).trim()) throw badRequest('attendeeName cannot be empty');
        patch.attendeeName = String(changes.attendeeName).trim();
      }
      if (changes.contactEmail !== undefined) {
        if (!EMAIL_RE.test(changes.contactEmail)) throw badRequest('a valid contactEmail is required');
        patch.contactEmail = changes.contactEmail.toLowerCase();
      }
      patch.updatedAt = clock().toISOString();
      return toView(store.appointments.update(appt.id, patch));
    },

    /** Cancelling marks the appointment cancelled; its slot is available again because only 'booked' blocks time. */
    cancel(actor, id, manageToken) {
      const appt = load(id);
      assertCanManage(appt, actor, manageToken);
      if (appt.status === 'cancelled') return toView(appt);
      return toView(
        store.appointments.update(appt.id, {
          status: 'cancelled',
          cancelledAt: clock().toISOString(),
          cancelledBy: actor?.role ?? 'anonymous',
        }),
      );
    },

    get(actor, id, manageToken) {
      const appt = load(id);
      assertCanManage(appt, actor, manageToken);
      return toView(appt);
    },

    /** Patrons see what they booked (including for others); providers see their calendar. */
    list(actor, { date, status } = {}) {
      if (!actor) throw unauthorized();
      const mine =
        actor.role === 'provider'
          ? (a) => a.providerId === actor.providerId
          : (a) => a.patronId === actor.id;
      return store.appointments
        .where((a) => mine(a) && (!date || a.date === date) && (!status || a.status === status))
        .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`))
        .map((a) => toView(a));
    },
  };
}
