// Hand-written test doubles. Nothing here touches a real database, the network or the system clock.
import { createMemoryStore } from '../../../src/repositories/memoryStore.js';
import { createAppointmentService } from '../../../src/services/appointmentService.js';
import { notFound } from '../../../src/errors.js';

// Fixed "now": Monday 2026-10-19, 12:00 local time.
export const NOW = new Date('2026-10-19T12:00:00');
export const TODAY = '2026-10-19'; // Monday
export const TOMORROW = '2026-10-20'; // Tuesday

/** A provider who works 09:00-17:00 on every weekday number, in 30-minute slots. */
export const makeProvider = (overrides = {}) => ({
  id: 'prov-1',
  slotMinutes: 30,
  weeklyHours: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [String(d), [{ start: '09:00', end: '17:00' }]])),
  ...overrides,
});

/** Stub for the provider service: only get(id) is needed by the appointment service. */
export const stubProviders = (...providers) => ({
  get(id) {
    const found = providers.find((p) => p.id === id);
    if (!found) throw notFound('provider not found', 'PROVIDER_NOT_FOUND');
    return found;
  },
});

/** Stub for the settings service. */
export const stubSettings = ({ requireRegistration = false } = {}) => ({
  get: () => ({ requireRegistration }),
});

/** Builds an appointment service with stubs and a frozen clock. The in-memory store acts as the fake database. */
export function buildAppointmentService({
  now = NOW,
  requireRegistration = false,
  providers = [makeProvider(), makeProvider({ id: 'prov-2' })],
} = {}) {
  const store = createMemoryStore();
  const service = createAppointmentService({
    store,
    providers: stubProviders(...providers),
    settings: stubSettings({ requireRegistration }),
    clock: () => now,
  });
  return { service, store };
}

export const guestInput = (overrides = {}) => ({
  providerId: 'prov-1',
  date: TOMORROW,
  start: '10:00',
  attendeeName: 'Gail Guest',
  contactEmail: 'gail@example.com',
  ...overrides,
});

export const patron = (overrides = {}) => ({
  id: 'patron-1',
  role: 'patron',
  name: 'Pat Patron',
  email: 'pat@example.com',
  ...overrides,
});

export const providerActor = (providerId = 'prov-1') => ({ id: 'user-p', role: 'provider', providerId, name: 'Alex' });
