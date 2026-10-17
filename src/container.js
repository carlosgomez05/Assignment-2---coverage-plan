import { createAuthService } from './services/authService.js';
import { createProviderService } from './services/providerService.js';
import { createSettingsService } from './services/settingsService.js';
import { createAppointmentService } from './services/appointmentService.js';

/**
 * Wires services together. This is the single place to swap the store (e.g. a SQL
 * repository) or inject a fake clock in tests.
 */
export function createServices({ store, clock }) {
  const auth = createAuthService({ store });
  const providers = createProviderService({ store });
  const settings = createSettingsService({ store });
  const appointments = createAppointmentService({ store, providers, settings, clock });
  return { auth, providers, settings, appointments };
}
