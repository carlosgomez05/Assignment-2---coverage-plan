import { beforeEach, describe, expect, it } from 'vitest';
import { createProviderService } from '../../src/services/providerService.js';
import { createSettingsService } from '../../src/services/settingsService.js';
import { MONDAY, createFakeStore } from './support/fakes.js';

// Block durations: a provider chooses a slot length (5-480 minutes, whole minutes) and
// working windows must end after they start.
describe('createProvider', () => {
  let providers;

  beforeEach(() => {
    providers = createProviderService({ store: createFakeStore() });
  });

  const create = (overrides = {}) => providers.create({ name: 'Alex', ...overrides });

  it('create_NoSlotMinutesSupplied_DefaultsToThirtyMinutes', () => {
    const result = create();

    expect(result.slotMinutes).toBe(30);
  });

  it('create_SlotMinutesAtLowerLimitOfFive_IsAccepted', () => {
    const result = create({ slotMinutes: 5 });

    expect(result.slotMinutes).toBe(5);
  });

  it('create_SlotMinutesJustBelowLimitAtFour_ThrowsBadRequest', () => {
    const act = () => create({ slotMinutes: 4 });

    expect(act).toThrowError(expect.objectContaining({ status: 400 }));
  });

  it('create_SlotMinutesAtUpperLimitOf480_IsAccepted', () => {
    const result = create({ slotMinutes: 480 });

    expect(result.slotMinutes).toBe(480);
  });

  it('create_SlotMinutesJustAboveLimitAt481_ThrowsBadRequest', () => {
    const act = () => create({ slotMinutes: 481 });

    expect(act).toThrowError(expect.objectContaining({ status: 400 }));
  });

  it('create_FractionalSlotMinutes_ThrowsBadRequest', () => {
    const act = () => create({ slotMinutes: 30.5 });

    expect(act).toThrowError(expect.objectContaining({ status: 400 }));
  });

  it('create_SlotMinutesGivenAsText_ThrowsBadRequest', () => {
    const act = () => create({ slotMinutes: '30' });

    expect(act).toThrowError(expect.objectContaining({ status: 400 }));
  });

  it('create_WindowEndsOneMinuteAfterStart_IsAccepted', () => {
    const result = create({ weeklyHours: { 1: [{ start: '09:00', end: '09:01' }] } });

    expect(result.weeklyHours[1]).toHaveLength(1);
  });

  it('create_WindowStartEqualsEnd_ThrowsBadRequest', () => {
    const act = () => create({ weeklyHours: { 1: [{ start: '09:00', end: '09:00' }] } });

    expect(act).toThrowError(expect.objectContaining({ status: 400 }));
  });

  it('create_WindowEndsBeforeItStarts_ThrowsBadRequest', () => {
    const act = () => create({ weeklyHours: { 1: [{ start: '17:00', end: '09:00' }] } });

    expect(act).toThrowError(expect.objectContaining({ status: 400 }));
  });

  it('create_WindowEndingAt2400_ThrowsBadRequest', () => {
    const act = () => create({ weeklyHours: { 1: [{ start: '09:00', end: '24:00' }] } });

    expect(act).toThrowError(expect.objectContaining({ status: 400 }));
  });

  it('create_WeekdayKeySevenOutOfRange_ThrowsBadRequest', () => {
    const act = () => create({ weeklyHours: { 7: [{ start: '09:00', end: '10:00' }] } });

    expect(act).toThrowError(expect.objectContaining({ status: 400 }));
  });

  it('create_MissingName_ThrowsBadRequest', () => {
    const act = () => providers.create({ name: '' });

    expect(act).toThrowError(expect.objectContaining({ status: 400 }));
  });
});

describe('providerSlots', () => {
  let store;
  let providers;
  let provider;

  beforeEach(() => {
    store = createFakeStore();
    providers = createProviderService({ store });
    provider = providers.create({ name: 'Alex', weeklyHours: { 1: [{ start: '09:00', end: '10:00' }] } });
  });

  const book = (status) =>
    store.appointments.insert({
      id: `a-${status}`, providerId: provider.id, date: MONDAY, start: '09:00', end: '09:30', status,
    });

  it('slots_BookedAppointmentInFirstSlot_FirstSlotIsUnavailable', () => {
    book('booked');

    const result = providers.slots(provider.id, MONDAY);

    expect(result.map((s) => s.available)).toEqual([false, true]);
  });

  it('slots_OnlyCancelledAppointmentInFirstSlot_AllSlotsAvailable', () => {
    book('cancelled');

    const result = providers.slots(provider.id, MONDAY);

    expect(result.every((s) => s.available)).toBe(true);
  });

  it('slots_UnknownProvider_ThrowsNotFound', () => {
    const act = () => providers.slots('nope', MONDAY);

    expect(act).toThrowError(expect.objectContaining({ code: 'PROVIDER_NOT_FOUND' }));
  });

  it('slots_NonexistentCalendarDate_ThrowsBadRequest', () => {
    const act = () => providers.slots(provider.id, '2030-02-30');

    expect(act).toThrowError(expect.objectContaining({ status: 400 }));
  });
});

// Vendor setting "registration required" (Patron registration area).
describe('updateSettings', () => {
  let settings;

  beforeEach(() => {
    settings = createSettingsService({ store: createFakeStore() });
  });

  const staff = { role: 'provider', providerId: 'prov-1' };

  it('update_ProviderTurnsRegistrationRequiredOn_ReturnsUpdatedSetting', () => {
    const result = settings.update(staff, { requireRegistration: true });

    expect(result.requireRegistration).toBe(true);
  });

  it('update_PatronTriesToChangeSetting_ThrowsForbidden', () => {
    const act = () => settings.update({ role: 'patron' }, { requireRegistration: true });

    expect(act).toThrowError(expect.objectContaining({ status: 403 }));
  });

  it('update_AnonymousUser_ThrowsForbidden', () => {
    const act = () => settings.update(null, { requireRegistration: true });

    expect(act).toThrowError(expect.objectContaining({ status: 403 }));
  });

  it('update_NonBooleanValue_ThrowsBadRequest', () => {
    const act = () => settings.update(staff, { requireRegistration: 'yes' });

    expect(act).toThrowError(expect.objectContaining({ status: 400 }));
  });

  it('update_UnknownSettingKey_IsIgnored', () => {
    const result = settings.update(staff, { isAdmin: true });

    expect(result).not.toHaveProperty('isAdmin');
  });
});
