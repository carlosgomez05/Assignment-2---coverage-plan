import { beforeEach, describe, expect, it } from 'vitest';
import { createProviderService } from '../../src/services/providerService.js';
import { MONDAY, SUNDAY, createFakeStore, makeProvider } from './support/fakes.js';

// Gap tests added after merging: providerService had 0% coverage.
// Requirements used: slot length 5-480 minutes; weekly hours keyed by weekday 0-6 with start < end;
// only the provider can change their own availability; booked slots show as unavailable.
const providerActor = { id: 'usr-p', role: 'provider', providerId: 'prov-1' };
let store;
let service;

beforeEach(() => {
  store = createFakeStore();
  store.providers.insert(makeProvider());
  service = createProviderService({ store });
});

describe('createProvider', () => {
  it('create_ValidInput_UsesDefaultsAndStoresProvider', () => {
    const p = service.create({ name: 'Sam' });

    expect(p).toMatchObject({ name: 'Sam', title: '', slotMinutes: 30, weeklyHours: {} });
    expect(service.get(p.id)).toEqual(p);
  });

  it('create_MissingName_ThrowsBadRequest', () => {
    expect(() => service.create({})).toThrowError(expect.objectContaining({ status: 400 }));
  });

  it.each([4, 481, 30.5, '30'])('create_SlotMinutes%s_ThrowsBadRequest', (slotMinutes) => {
    expect(() => service.create({ name: 'Sam', slotMinutes })).toThrowError(expect.objectContaining({ status: 400 }));
  });

  it.each([5, 480])('create_SlotMinutesBoundary%s_IsAccepted', (slotMinutes) => {
    expect(service.create({ name: 'Sam', slotMinutes }).slotMinutes).toBe(slotMinutes);
  });

  it.each([
    ['array instead of object', []],
    ['null', null],
    ['weekday key 7', { 7: [] }],
    ['windows not an array', { 1: 'all day' }],
    ['start equals end', { 1: [{ start: '09:00', end: '09:00' }] }],
    ['bad time format', { 1: [{ start: '9am', end: '17:00' }] }],
  ])('create_WeeklyHours_%s_ThrowsBadRequest', (_label, weeklyHours) => {
    expect(() => service.create({ name: 'Sam', weeklyHours })).toThrowError(expect.objectContaining({ status: 400 }));
  });
});

describe('getProvider', () => {
  it('get_UnknownId_ThrowsProviderNotFound', () => {
    expect(() => service.get('nope')).toThrowError(expect.objectContaining({ status: 404, code: 'PROVIDER_NOT_FOUND' }));
  });

  it('list_ReturnsAllProviders', () => {
    service.create({ name: 'Sam' });

    expect(service.list()).toHaveLength(2);
  });
});

describe('setAvailability', () => {
  it('setAvailability_OwnProvider_UpdatesOnlyGivenFields', () => {
    const result = service.setAvailability(providerActor, 'prov-1', { slotMinutes: 60 });

    expect(result.slotMinutes).toBe(60);
    expect(result.weeklyHours).toEqual(makeProvider().weeklyHours);
  });

  it('setAvailability_OtherProvider_ThrowsForbidden', () => {
    const other = { ...providerActor, providerId: 'prov-2' };

    expect(() => service.setAvailability(other, 'prov-1', { slotMinutes: 60 })).toThrowError(
      expect.objectContaining({ status: 403 }),
    );
  });

  it('setAvailability_Patron_ThrowsForbidden', () => {
    expect(() => service.setAvailability({ id: 'p', role: 'patron' }, 'prov-1', {})).toThrowError(
      expect.objectContaining({ status: 403 }),
    );
  });

  it('setAvailability_InvalidWeeklyHours_ThrowsBadRequest', () => {
    expect(() =>
      service.setAvailability(providerActor, 'prov-1', { weeklyHours: { 1: [{ start: '17:00', end: '09:00' }] } }),
    ).toThrowError(expect.objectContaining({ status: 400 }));
  });
});

describe('providerSlots', () => {
  it('slots_InvalidDate_ThrowsBadRequest', () => {
    expect(() => service.slots('prov-1', '07/01/2030')).toThrowError(expect.objectContaining({ status: 400 }));
  });

  it('slots_BookedSlot_IsMarkedUnavailableButCancelledIsNot', () => {
    store.appointments.insert({ id: 'a1', providerId: 'prov-1', date: MONDAY, start: '09:00', end: '09:30', status: 'booked' });
    store.appointments.insert({ id: 'a2', providerId: 'prov-1', date: MONDAY, start: '09:30', end: '10:00', status: 'cancelled' });

    const slots = service.slots('prov-1', MONDAY);

    expect(slots[0]).toMatchObject({ start: '09:00', available: false });
    expect(slots[1]).toMatchObject({ start: '09:30', available: true });
  });

  it('slots_DayOff_ReturnsEmpty', () => {
    expect(service.slots('prov-1', SUNDAY)).toEqual([]);
  });
});
