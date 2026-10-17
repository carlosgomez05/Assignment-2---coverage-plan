import crypto from 'node:crypto';
import { slotsWithStatus } from '../domain/availability.js';
import { isDate, isTime, toMinutes } from '../domain/time.js';
import { badRequest, forbidden, notFound } from '../errors.js';

function validateWeeklyHours(weeklyHours) {
  if (typeof weeklyHours !== 'object' || weeklyHours === null || Array.isArray(weeklyHours)) {
    throw badRequest('weeklyHours must be an object keyed by weekday (0-6)');
  }
  for (const [day, windows] of Object.entries(weeklyHours)) {
    if (!/^[0-6]$/.test(day)) throw badRequest(`invalid weekday key "${day}"`);
    if (!Array.isArray(windows)) throw badRequest(`weeklyHours.${day} must be an array`);
    for (const w of windows) {
      if (!isTime(w?.start) || !isTime(w?.end) || toMinutes(w.start) >= toMinutes(w.end)) {
        throw badRequest(`invalid window on weekday ${day}`);
      }
    }
  }
}

function validateSlotMinutes(n) {
  if (!Number.isInteger(n) || n < 5 || n > 480) throw badRequest('slotMinutes must be an integer between 5 and 480');
}

export function createProviderService({ store }) {
  const get = (id) => {
    const provider = store.providers.get(id);
    if (!provider) throw notFound('provider not found', 'PROVIDER_NOT_FOUND');
    return provider;
  };

  return {
    get,
    list: () => store.providers.where(),

    create({ name, title = '', slotMinutes = 30, weeklyHours = {} }) {
      if (!name) throw badRequest('name is required');
      validateSlotMinutes(slotMinutes);
      validateWeeklyHours(weeklyHours);
      return store.providers.insert({ id: crypto.randomUUID(), name, title, slotMinutes, weeklyHours });
    },

    /** Providers manage their own availability. Existing bookings are not moved (assumption A5). */
    setAvailability(actor, providerId, { slotMinutes, weeklyHours }) {
      const provider = get(providerId);
      if (actor?.role !== 'provider' || actor.providerId !== providerId) {
        throw forbidden('only the provider can change their availability');
      }
      if (slotMinutes !== undefined) validateSlotMinutes(slotMinutes);
      if (weeklyHours !== undefined) validateWeeklyHours(weeklyHours);
      return store.providers.update(provider.id, {
        ...(slotMinutes !== undefined && { slotMinutes }),
        ...(weeklyHours !== undefined && { weeklyHours }),
      });
    },

    slots(providerId, date) {
      if (!isDate(date)) throw badRequest('date must be YYYY-MM-DD');
      const provider = get(providerId);
      const booked = store.appointments.where(
        (a) => a.providerId === providerId && a.date === date && a.status === 'booked',
      );
      return slotsWithStatus(provider, date, booked);
    },
  };
}
