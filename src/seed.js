// Demo data so the app is usable on first run. Demo credentials only; never ship these.
const weekdays = (start, end) =>
  Object.fromEntries(['1', '2', '3', '4', '5'].map((d) => [d, [{ start, end }]]));

export function seedDemoData({ providers, auth }) {
  const alex = providers.create({
    name: 'Alex Rivera',
    title: 'Barber',
    slotMinutes: 30,
    weeklyHours: weekdays('09:00', '17:00'),
  });
  const sam = providers.create({
    name: 'Sam Chen',
    title: 'Stylist',
    slotMinutes: 60,
    weeklyHours: { ...weekdays('10:00', '18:00'), 6: [{ start: '10:00', end: '14:00' }] },
  });
  auth.createProviderAccount({ name: alex.name, email: 'alex@salon.test', password: 'password123', providerId: alex.id });
  auth.createProviderAccount({ name: sam.name, email: 'sam@salon.test', password: 'password123', providerId: sam.id });
  return { alex, sam };
}
