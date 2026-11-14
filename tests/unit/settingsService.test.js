import { beforeEach, describe, expect, it } from 'vitest';
import { createSettingsService } from '../../src/services/settingsService.js';
import { createFakeStore } from './support/fakes.js';

// Gap tests added after merging: settingsService had 0% coverage.
// Requirements used: only vendor staff (provider accounts, assumption A3) can change settings;
// requireRegistration must be a boolean; unknown keys are ignored.
describe('settings', () => {
  let service;
  beforeEach(() => {
    service = createSettingsService({ store: createFakeStore() });
  });

  it('update_Provider_SetsRequireRegistration', () => {
    service.update({ role: 'provider' }, { requireRegistration: true });

    expect(service.get().requireRegistration).toBe(true);
  });

  it.each([null, { role: 'patron' }])('update_NotProvider_ThrowsForbidden', (actor) => {
    expect(() => service.update(actor, { requireRegistration: true })).toThrowError(
      expect.objectContaining({ status: 403 }),
    );
  });

  it('update_NonBooleanValue_ThrowsBadRequest', () => {
    expect(() => service.update({ role: 'provider' }, { requireRegistration: 'yes' })).toThrowError(
      expect.objectContaining({ status: 400 }),
    );
  });

  it('update_UnknownKey_IsIgnored', () => {
    service.update({ role: 'provider' }, { isAdmin: true });

    expect(service.get()).toEqual({ requireRegistration: false });
  });
});
