// Hand-written test doubles so unit tests never touch the real store or system clock.

const fakeCollection = () => {
  const items = new Map();
  return {
    insert: (item) => (items.set(item.id, item), item),
    get: (id) => items.get(id),
    update: (id, patch) => {
      if (!items.has(id)) return undefined;
      const next = { ...items.get(id), ...patch };
      items.set(id, next);
      return next;
    },
    where: (predicate = () => true) => [...items.values()].filter(predicate),
  };
};

export const createFakeStore = ({ requireRegistration = false } = {}) => {
  let settings = { requireRegistration };
  return {
    users: fakeCollection(),
    providers: fakeCollection(),
    appointments: fakeCollection(),
    sessions: fakeCollection(),
    settings: {
      get: () => ({ ...settings }),
      update: (patch) => (settings = { ...settings, ...patch }),
    },
  };
};

// Local-time Date, matching how the app interprets "YYYY-MM-DD" + "HH:MM".
export const at = (y, m, d, hh = 0, mm = 0) => new Date(y, m - 1, d, hh, mm);

export const fixedClock = (now) => () => new Date(now.getTime());

// 2030-01-07 is a Monday; every provider below works Monday 09:00-17:00.
export const MONDAY = '2030-01-07';
export const TUESDAY = '2030-01-08';
export const SUNDAY = '2030-01-06';

export const makeProvider = (overrides = {}) => ({
  id: 'prov-1',
  name: 'Alex Rivera',
  title: 'Barber',
  slotMinutes: 30,
  weeklyHours: { 1: [{ start: '09:00', end: '17:00' }] },
  ...overrides,
});
