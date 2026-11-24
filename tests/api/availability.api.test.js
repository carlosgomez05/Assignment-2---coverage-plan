import { describe, it, expect } from 'vitest';
import { call, futureDate, newPatron, providerLogin, useCleanup, book } from './support/api.js';

const MONDAY = 1;
const SUNDAY = 0;
const cleanup = useCleanup();

describe('API: provider availability and slots', () => {
  it('lists providers including the seeded ones', async () => {
    const res = await call('GET', '/api/providers');
    expect(res.status).toBe(200);
    expect(res.body.map((p) => p.name)).toEqual(expect.arrayContaining(['Alex Rivera', 'Sam Chen']));
  });

  it('returns 404 PROVIDER_NOT_FOUND for an unknown provider', async () => {
    const res = await call('GET', '/api/providers/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PROVIDER_NOT_FOUND');
  });

  it('generates 16 half-hour slots for Alex on a Monday (09:00-17:00), all available', async () => {
    const alex = await providerLogin('alex');
    const res = await call('GET', `/api/providers/${alex.providerId}/slots?date=${futureDate(MONDAY)}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(16);
    expect(res.body[0]).toEqual({ start: '09:00', end: '09:30', available: true });
    expect(res.body.at(-1)).toEqual({ start: '16:30', end: '17:00', available: true });
    expect(res.body.every((s) => s.available)).toBe(true);
  });

  it('returns no slots on a day the provider does not work', async () => {
    const alex = await providerLogin('alex');
    const res = await call('GET', `/api/providers/${alex.providerId}/slots?date=${futureDate(SUNDAY)}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it.each([
    ['missing date', ''],
    ['wrong format', '?date=12-25-2030'],
    ['impossible date', '?date=2030-02-30'],
  ])('rejects slots request with %s (400)', async (_l, qs) => {
    const alex = await providerLogin('alex');
    const res = await call('GET', `/api/providers/${alex.providerId}/slots${qs}`);
    expect(res.status).toBe(400);
  });

  it('shows a booked slot as unavailable, and available again after cancel', async () => {
    const alex = await providerLogin('alex');
    const patron = await newPatron('slots');
    const date = futureDate(MONDAY);
    const booked = await book(cleanup, { token: patron.token, cancelWith: alex.token, input: { providerId: alex.providerId, date, start: '10:00' } });
    expect(booked.status).toBe(201);

    const during = (await call('GET', `/api/providers/${alex.providerId}/slots?date=${date}`)).body;
    expect(during.find((s) => s.start === '10:00').available).toBe(false);
    expect(during.find((s) => s.start === '10:30').available).toBe(true);

    await call('DELETE', `/api/appointments/${booked.body.id}`, { token: patron.token });
    const after = (await call('GET', `/api/providers/${alex.providerId}/slots?date=${date}`)).body;
    expect(after.find((s) => s.start === '10:00').available).toBe(true);
  });

  it('lets a provider change their own slot length (and restores it afterwards)', async () => {
    const alex = await providerLogin('alex');
    const original = { slotMinutes: alex.profile.slotMinutes, weeklyHours: alex.profile.weeklyHours };
    cleanup.add(() => call('PUT', `/api/providers/${alex.providerId}/availability`, { token: alex.token, body: original }));

    const res = await call('PUT', `/api/providers/${alex.providerId}/availability`, { token: alex.token, body: { slotMinutes: 60 } });
    expect(res.status).toBe(200);
    expect(res.body.slotMinutes).toBe(60);
    const slots = (await call('GET', `/api/providers/${alex.providerId}/slots?date=${futureDate(MONDAY)}`)).body;
    expect(slots).toHaveLength(8);
  });

  it('lets a provider change weekly hours (and restores them afterwards)', async () => {
    const alex = await providerLogin('alex');
    const original = { slotMinutes: alex.profile.slotMinutes, weeklyHours: alex.profile.weeklyHours };
    cleanup.add(() => call('PUT', `/api/providers/${alex.providerId}/availability`, { token: alex.token, body: original }));

    const weeklyHours = { 0: [{ start: '12:00', end: '13:00' }] };
    const res = await call('PUT', `/api/providers/${alex.providerId}/availability`, { token: alex.token, body: { weeklyHours } });
    expect(res.status).toBe(200);
    const sunday = (await call('GET', `/api/providers/${alex.providerId}/slots?date=${futureDate(SUNDAY)}`)).body;
    expect(sunday.map((s) => s.start)).toEqual(['12:00', '12:30']);
    const monday = (await call('GET', `/api/providers/${alex.providerId}/slots?date=${futureDate(MONDAY)}`)).body;
    expect(monday).toEqual([]);
  });

  it('forbids anonymous users and patrons from changing availability (403)', async () => {
    const alex = await providerLogin('alex');
    const patron = await newPatron('avail');
    const url = `/api/providers/${alex.providerId}/availability`;
    expect((await call('PUT', url, { body: { slotMinutes: 15 } })).status).toBe(403);
    expect((await call('PUT', url, { token: patron.token, body: { slotMinutes: 15 } })).status).toBe(403);
    expect((await call('GET', `/api/providers/${alex.providerId}`)).body.slotMinutes).toBe(alex.profile.slotMinutes);
  });

  it("forbids one provider from changing another provider's availability (403)", async () => {
    const alex = await providerLogin('alex');
    const sam = await providerLogin('sam');
    const res = await call('PUT', `/api/providers/${alex.providerId}/availability`, { token: sam.token, body: { slotMinutes: 15 } });
    expect(res.status).toBe(403);
  });

  it.each([
    ['slotMinutes too small', { slotMinutes: 3 }],
    ['slotMinutes not an integer', { slotMinutes: 'thirty' }],
    ['slotMinutes too large', { slotMinutes: 600 }],
    ['weekday key out of range', { weeklyHours: { 9: [{ start: '09:00', end: '10:00' }] } }],
    ['window end before start', { weeklyHours: { 1: [{ start: '17:00', end: '09:00' }] } }],
    ['window with bad time', { weeklyHours: { 1: [{ start: '9am', end: '5pm' }] } }],
    ['weeklyHours is an array', { weeklyHours: [] }],
  ])('rejects invalid availability: %s (400) and leaves the schedule unchanged', async (_l, body) => {
    const alex = await providerLogin('alex');
    const res = await call('PUT', `/api/providers/${alex.providerId}/availability`, { token: alex.token, body });
    expect(res.status).toBe(400);
    const after = (await call('GET', `/api/providers/${alex.providerId}`)).body;
    expect(after.slotMinutes).toBe(alex.profile.slotMinutes);
    expect(after.weeklyHours).toEqual(alex.profile.weeklyHours);
  });
});
