import { describe, it, expect } from 'vitest';
import { call, futureDate, pastDate, newPatron, providerLogin, useCleanup, book } from './support/api.js';

const MONDAY = 1;
const cleanup = useCleanup();

/** Fresh provider login + a patron + a free Monday, so each test owns its data. */
async function setup() {
  const alex = await providerLogin('alex');
  const patron = await newPatron('appt');
  return { alex, patron, date: futureDate(MONDAY), pid: alex.providerId };
}

describe('API: create appointment', () => {
  it('a logged-in patron books a slot (201) and receives a manage token', async () => {
    const { alex, patron, date, pid } = await setup();
    const res = await book(cleanup, { token: patron.token, cancelWith: alex.token, input: { providerId: pid, date, start: '09:00' } });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      providerId: pid, date, start: '09:00', end: '09:30', status: 'booked',
      bookedBy: 'patron', patronId: patron.id, attendeeName: 'Test appt',
    });
    expect(res.body.manageToken).toMatch(/^[0-9a-f]{24}$/);
  });

  it('a patron can book for someone else (attendeeName) and it shows in their list', async () => {
    const { alex, patron, date, pid } = await setup();
    const res = await book(cleanup, { token: patron.token, cancelWith: alex.token, input: { providerId: pid, date, start: '09:30', attendeeName: 'Grandma' } });
    expect(res.status).toBe(201);
    expect(res.body.attendeeName).toBe('Grandma');
    const list = await call('GET', '/api/appointments', { token: patron.token });
    expect(list.body.map((a) => a.id)).toContain(res.body.id);
  });

  it('an anonymous guest books with name + email (201)', async () => {
    const { alex, date, pid } = await setup();
    const res = await book(cleanup, { cancelWith: alex.token, input: { providerId: pid, date, start: '10:00', attendeeName: 'Guest G', contactEmail: 'Guest@Example.test' } });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ bookedBy: 'anonymous', patronId: null, contactEmail: 'guest@example.test' });
  });

  it('a provider books a walk-in on their own calendar without an email (201)', async () => {
    const { alex, date, pid } = await setup();
    const res = await book(cleanup, { token: alex.token, cancelWith: alex.token, input: { providerId: pid, date, start: '10:30', attendeeName: 'Walk-in' } });
    expect(res.status).toBe(201);
    expect(res.body.bookedBy).toBe('provider');
  });

  it("a provider cannot book on another provider's calendar (403)", async () => {
    const { date } = await setup();
    const sam = await providerLogin('sam');
    const alex = await providerLogin('alex');
    const res = await book(cleanup, { token: sam.token, cancelWith: alex.token, input: { providerId: alex.providerId, date, start: '11:00', attendeeName: 'X' } });
    expect(res.status).toBe(403);
  });

  it('rejects a second booking of the same slot (409 SLOT_TAKEN)', async () => {
    const { alex, patron, date, pid } = await setup();
    const other = await newPatron('rival');
    const first = await book(cleanup, { token: patron.token, cancelWith: alex.token, input: { providerId: pid, date, start: '11:00' } });
    const second = await book(cleanup, { token: other.token, cancelWith: alex.token, input: { providerId: pid, date, start: '11:00' } });
    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('SLOT_TAKEN');
  });

  it('two simultaneous requests for one slot: exactly one wins', async () => {
    const { alex, date, pid } = await setup();
    const input = (n) => ({ providerId: pid, date, start: '11:30', attendeeName: `Racer ${n}`, contactEmail: `r${n}@example.test` });
    const results = await Promise.all([1, 2, 3, 4].map((n) => book(cleanup, { cancelWith: alex.token, input: input(n) })));
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409, 409, 409]);
  });

  it.each([
    ['bad date format', { date: '01/02/2030', start: '09:00' }, 400, 'BAD_REQUEST'],
    ['impossible date', { date: '2030-02-30', start: '09:00' }, 400, 'BAD_REQUEST'],
    ['bad time format', { date: 'FUTURE', start: '9am' }, 400, 'BAD_REQUEST'],
    ['time not on the slot grid', { date: 'FUTURE', start: '09:10' }, 400, 'NOT_A_SLOT'],
    ['outside working hours', { date: 'FUTURE', start: '20:00' }, 400, 'NOT_A_SLOT'],
    ['in the past', { date: 'PAST', start: '09:00' }, 400, 'IN_THE_PAST'],
  ])('rejects %s', async (_l, over, status, code) => {
    const { alex, patron, date, pid } = await setup();
    const input = { providerId: pid, ...over, date: over.date === 'FUTURE' ? date : over.date === 'PAST' ? pastDate() : over.date };
    const res = await book(cleanup, { token: patron.token, cancelWith: alex.token, input });
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(code);
  });

  it('rejects an unknown provider (404)', async () => {
    const { patron, date } = await setup();
    const res = await call('POST', '/api/appointments', { token: patron.token, body: { providerId: 'nope', date, start: '09:00' } });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PROVIDER_NOT_FOUND');
  });

  it('rejects a guest booking without a valid contact email (400)', async () => {
    const { alex, date, pid } = await setup();
    const noEmail = await book(cleanup, { cancelWith: alex.token, input: { providerId: pid, date, start: '12:00', attendeeName: 'G' } });
    const badEmail = await book(cleanup, { cancelWith: alex.token, input: { providerId: pid, date, start: '12:00', attendeeName: 'G', contactEmail: 'nope' } });
    expect(noEmail.status).toBe(400);
    expect(badEmail.status).toBe(400);
  });

  it('rejects a guest booking without a name (400)', async () => {
    const { alex, date, pid } = await setup();
    const res = await book(cleanup, { cancelWith: alex.token, input: { providerId: pid, date, start: '12:00', contactEmail: 'g@example.test' } });
    expect(res.status).toBe(400);
  });

  it('requires registration when the vendor setting is on (401), and restores the setting', async () => {
    const { alex, date, pid } = await setup();
    const before = (await call('GET', '/api/settings')).body;
    cleanup.add(() => call('PUT', '/api/settings', { token: alex.token, body: { requireRegistration: before.requireRegistration } }));
    expect((await call('PUT', '/api/settings', { token: alex.token, body: { requireRegistration: true } })).status).toBe(200);

    const guest = await book(cleanup, { cancelWith: alex.token, input: { providerId: pid, date, start: '13:00', attendeeName: 'G', contactEmail: 'g@example.test' } });
    expect(guest.status).toBe(401);
    expect(guest.body.error.code).toBe('REGISTRATION_REQUIRED');

    const patron = await newPatron('reg-required');
    const member = await book(cleanup, { token: patron.token, cancelWith: alex.token, input: { providerId: pid, date, start: '13:00' } });
    expect(member.status).toBe(201);
  });
});

describe('API: change appointment', () => {
  it('a patron reschedules their booking: the old slot is freed, the new one taken', async () => {
    const { alex, patron, date, pid } = await setup();
    const created = await book(cleanup, { token: patron.token, cancelWith: alex.token, input: { providerId: pid, date, start: '09:00' } });
    const res = await call('PATCH', `/api/appointments/${created.body.id}`, { token: patron.token, body: { start: '14:00' } });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ start: '14:00', end: '14:30', status: 'booked' });
    expect(res.body.manageToken).toBeUndefined(); // token only shown at creation

    const slots = (await call('GET', `/api/providers/${pid}/slots?date=${date}`)).body;
    expect(slots.find((s) => s.start === '09:00').available).toBe(true);
    expect(slots.find((s) => s.start === '14:00').available).toBe(false);
  });

  it('a patron can move a booking to a different day', async () => {
    const { alex, patron, date, pid } = await setup();
    const created = await book(cleanup, { token: patron.token, cancelWith: alex.token, input: { providerId: pid, date, start: '09:00' } });
    const newDate = futureDate(MONDAY, 70);
    const res = await call('PATCH', `/api/appointments/${created.body.id}`, { token: patron.token, body: { date: newDate } });
    expect(res.status).toBe(200);
    expect(res.body.date).toBe(newDate);
  });

  it('a patron can move a booking to a different provider', async () => {
    const { alex, patron, date } = await setup();
    const sam = await providerLogin('sam');
    const created = await book(cleanup, { token: patron.token, cancelWith: alex.token, input: { providerId: alex.providerId, date, start: '10:00' } });
    // Sam works 10:00-18:00 in 60-min slots on weekdays, so 10:00 is a valid Sam slot.
    const res = await call('PATCH', `/api/appointments/${created.body.id}`, { token: patron.token, body: { providerId: sam.providerId } });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ providerId: sam.providerId, start: '10:00', end: '11:00' });
  });

  it('a guest edits attendee details with the manage token', async () => {
    const { alex, date, pid } = await setup();
    const created = await book(cleanup, { cancelWith: alex.token, input: { providerId: pid, date, start: '09:30', attendeeName: 'Old Name', contactEmail: 'old@example.test' } });
    const res = await call('PATCH', `/api/appointments/${created.body.id}`, {
      manageToken: created.body.manageToken, body: { attendeeName: ' New Name ', contactEmail: 'New@Example.test' },
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ attendeeName: 'New Name', contactEmail: 'new@example.test' });
  });

  it('the provider can reschedule an appointment on their own calendar', async () => {
    const { alex, patron, date, pid } = await setup();
    const created = await book(cleanup, { token: patron.token, cancelWith: alex.token, input: { providerId: pid, date, start: '09:00' } });
    const res = await call('PATCH', `/api/appointments/${created.body.id}`, { token: alex.token, body: { start: '15:00' } });
    expect(res.status).toBe(200);
    expect(res.body.start).toBe('15:00');
  });

  it('rejects changes with no / wrong manage token, another patron, or another provider (403) and changes nothing', async () => {
    const { alex, date, pid } = await setup();
    const created = await book(cleanup, { cancelWith: alex.token, input: { providerId: pid, date, start: '10:00', attendeeName: 'Guest', contactEmail: 'g@example.test' } });
    const url = `/api/appointments/${created.body.id}`;
    const stranger = await newPatron('stranger');
    const sam = await providerLogin('sam');
    const body = { attendeeName: 'Hacked' };

    expect((await call('PATCH', url, { body })).status).toBe(403);
    expect((await call('PATCH', url, { manageToken: 'wrong', body })).status).toBe(403);
    expect((await call('PATCH', url, { token: stranger.token, body })).status).toBe(403);
    expect((await call('PATCH', url, { token: sam.token, body })).status).toBe(403);

    const check = await call('GET', url, { manageToken: created.body.manageToken });
    expect(check.body.attendeeName).toBe('Guest');
  });

  it('rejects rescheduling onto a taken slot (409) and keeps the original time', async () => {
    const { alex, patron, date, pid } = await setup();
    const a = await book(cleanup, { token: patron.token, cancelWith: alex.token, input: { providerId: pid, date, start: '09:00' } });
    await book(cleanup, { token: alex.token, cancelWith: alex.token, input: { providerId: pid, date, start: '09:30', attendeeName: 'Blocker' } });
    const res = await call('PATCH', `/api/appointments/${a.body.id}`, { token: patron.token, body: { start: '09:30' } });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLOT_TAKEN');
    expect((await call('GET', `/api/appointments/${a.body.id}`, { token: patron.token })).body.start).toBe('09:00');
  });

  it.each([
    ['a time off the grid', { start: '09:10' }, 400],
    ['a malformed date', { date: 'tomorrow' }, 400],
    ['a date in the past', { date: '2020-01-06' }, 400],
    ['an empty attendee name', { attendeeName: '   ' }, 400],
    ['an invalid contact email', { contactEmail: 'nope' }, 400],
  ])('rejects changing to %s', async (_l, body, status) => {
    const { alex, patron, date, pid } = await setup();
    const created = await book(cleanup, { token: patron.token, cancelWith: alex.token, input: { providerId: pid, date, start: '09:00' } });
    const res = await call('PATCH', `/api/appointments/${created.body.id}`, { token: patron.token, body });
    expect(res.status).toBe(status);
  });

  it('rejects changing a cancelled appointment (409 ALREADY_CANCELLED)', async () => {
    const { alex, patron, date, pid } = await setup();
    const created = await book(cleanup, { token: patron.token, cancelWith: alex.token, input: { providerId: pid, date, start: '09:00' } });
    await call('DELETE', `/api/appointments/${created.body.id}`, { token: patron.token });
    const res = await call('PATCH', `/api/appointments/${created.body.id}`, { token: patron.token, body: { start: '10:00' } });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_CANCELLED');
  });

  it('returns 404 for an unknown appointment id', async () => {
    const patron = await newPatron('ghost');
    const res = await call('PATCH', '/api/appointments/does-not-exist', { token: patron.token, body: { start: '10:00' } });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('APPOINTMENT_NOT_FOUND');
  });
});

describe('API: cancel appointment', () => {
  it('the owner cancels (200, status cancelled) and the slot can be rebooked', async () => {
    const { alex, patron, date, pid } = await setup();
    const created = await book(cleanup, { token: patron.token, cancelWith: alex.token, input: { providerId: pid, date, start: '09:00' } });
    const res = await call('DELETE', `/api/appointments/${created.body.id}`, { token: patron.token });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'cancelled', cancelledBy: 'patron' });

    const rebook = await book(cleanup, { token: (await newPatron('rebook')).token, cancelWith: alex.token, input: { providerId: pid, date, start: '09:00' } });
    expect(rebook.status).toBe(201);
  });

  it('a guest cancels with the manage token', async () => {
    const { alex, date, pid } = await setup();
    const created = await book(cleanup, { cancelWith: alex.token, input: { providerId: pid, date, start: '09:30', attendeeName: 'G', contactEmail: 'g@example.test' } });
    const res = await call('DELETE', `/api/appointments/${created.body.id}`, { manageToken: created.body.manageToken });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'cancelled', cancelledBy: 'anonymous' });
  });

  it('the provider cancels an appointment on their calendar', async () => {
    const { alex, patron, date, pid } = await setup();
    const created = await book(cleanup, { token: patron.token, cancelWith: alex.token, input: { providerId: pid, date, start: '10:00' } });
    const res = await call('DELETE', `/api/appointments/${created.body.id}`, { token: alex.token });
    expect(res.status).toBe(200);
    expect(res.body.cancelledBy).toBe('provider');
  });

  it('rejects cancelling without credentials, with a wrong token, as another patron or provider (403); booking stays', async () => {
    const { alex, patron, date, pid } = await setup();
    const created = await book(cleanup, { token: patron.token, cancelWith: alex.token, input: { providerId: pid, date, start: '10:30' } });
    const url = `/api/appointments/${created.body.id}`;
    const stranger = await newPatron('stranger2');
    const sam = await providerLogin('sam');

    expect((await call('DELETE', url)).status).toBe(403);
    expect((await call('DELETE', url, { manageToken: 'wrong' })).status).toBe(403);
    expect((await call('DELETE', url, { token: stranger.token })).status).toBe(403);
    expect((await call('DELETE', url, { token: sam.token })).status).toBe(403);
    expect((await call('GET', url, { token: patron.token })).body.status).toBe('booked');
  });

  it('cancelling twice is harmless (200 both times)', async () => {
    const { alex, patron, date, pid } = await setup();
    const created = await book(cleanup, { token: patron.token, cancelWith: alex.token, input: { providerId: pid, date, start: '11:00' } });
    expect((await call('DELETE', `/api/appointments/${created.body.id}`, { token: patron.token })).status).toBe(200);
    const again = await call('DELETE', `/api/appointments/${created.body.id}`, { token: patron.token });
    expect(again.status).toBe(200);
    expect(again.body.status).toBe('cancelled');
  });

  it('returns 404 for an unknown appointment id', async () => {
    const patron = await newPatron('ghost2');
    const res = await call('DELETE', '/api/appointments/does-not-exist', { token: patron.token });
    expect(res.status).toBe(404);
  });
});

describe('API: list appointments', () => {
  it('requires login (401)', async () => {
    const res = await call('GET', '/api/appointments');
    expect(res.status).toBe(401);
  });

  it('a patron sees only their own bookings, filterable by status and date', async () => {
    const { alex, patron, date, pid } = await setup();
    const other = await newPatron('other');
    const mine = await book(cleanup, { token: patron.token, cancelWith: alex.token, input: { providerId: pid, date, start: '09:00' } });
    const gone = await book(cleanup, { token: patron.token, cancelWith: alex.token, input: { providerId: pid, date, start: '09:30' } });
    const theirs = await book(cleanup, { token: other.token, cancelWith: alex.token, input: { providerId: pid, date, start: '10:00' } });
    await call('DELETE', `/api/appointments/${gone.body.id}`, { token: patron.token });

    const all = (await call('GET', '/api/appointments', { token: patron.token })).body.map((a) => a.id);
    expect(all).toEqual(expect.arrayContaining([mine.body.id, gone.body.id]));
    expect(all).not.toContain(theirs.body.id);

    const booked = (await call('GET', `/api/appointments?status=booked&date=${date}`, { token: patron.token })).body;
    expect(booked.map((a) => a.id)).toEqual([mine.body.id]);
    expect(booked[0].manageToken).toBeUndefined();
  });

  it("a provider sees their calendar, sorted by time, including other people's bookings", async () => {
    const { alex, patron, date, pid } = await setup();
    const late = await book(cleanup, { token: patron.token, cancelWith: alex.token, input: { providerId: pid, date, start: '16:00' } });
    const early = await book(cleanup, { cancelWith: alex.token, input: { providerId: pid, date, start: '09:00', attendeeName: 'G', contactEmail: 'g@example.test' } });
    const day = (await call('GET', `/api/appointments?date=${date}&status=booked`, { token: alex.token })).body;
    expect(day.map((a) => a.id)).toEqual([early.body.id, late.body.id]);
  });
});

describe('API: settings', () => {
  it('anyone can read settings; patrons and anonymous cannot change them (403)', async () => {
    const patron = await newPatron('settings');
    expect((await call('GET', '/api/settings')).status).toBe(200);
    expect((await call('PUT', '/api/settings', { body: { requireRegistration: true } })).status).toBe(403);
    expect((await call('PUT', '/api/settings', { token: patron.token, body: { requireRegistration: true } })).status).toBe(403);
    expect((await call('GET', '/api/settings')).body.requireRegistration).toBe(false);
  });

  it('rejects a non-boolean requireRegistration (400)', async () => {
    const alex = await providerLogin('alex');
    const res = await call('PUT', '/api/settings', { token: alex.token, body: { requireRegistration: 'yes' } });
    expect(res.status).toBe(400);
  });
});
