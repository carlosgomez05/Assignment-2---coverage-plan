import { badRequest, forbidden } from '../errors.js';

// Vendor-level switches. Add new settings here as requirements emerge.
export function createSettingsService({ store }) {
  return {
    get: () => store.settings.get(),

    // Assumption A3: any provider account acts as vendor admin until a real admin role exists.
    update(actor, patch) {
      if (actor?.role !== 'provider') throw forbidden('only vendor staff can change settings');
      if ('requireRegistration' in patch && typeof patch.requireRegistration !== 'boolean') {
        throw badRequest('requireRegistration must be true or false');
      }
      const allowed = {};
      if ('requireRegistration' in patch) allowed.requireRegistration = patch.requireRegistration;
      return store.settings.update(allowed);
    },
  };
}
