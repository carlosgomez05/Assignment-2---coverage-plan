// Helpers for API tests. These talk to a RUNNING server over HTTP (see API_BASE_URL).
// The app keeps data in memory and has no delete endpoint for users, so tests
// (1) use unique emails, (2) cancel every appointment they book, and
// (3) restore any provider/settings change they make.
import { afterEach } from 'vitest';

export const BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';

export async function call(method, path, { token, manageToken, body, rawBody } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (manageToken) headers['x-manage-token'] = manageToken;
  if (body !== undefined || rawBody !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: rawBody ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON body */ }
  return { status: res.status, body: json };
}

export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** A YYYY-MM-DD in the future that falls on `weekday` (0=Sun..6=Sat), 3-60 weeks out so it is never "in the past". */
export function futureDate(weekday, minWeeks = 3) {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 7 * (minWeeks + Math.floor(Math.random() * 57)));
  while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
export const pastDate = () => '2020-01-06'; // a Monday

/** Register a fresh patron (unique email) and log in. */
export async function newPatron(label = 'patron') {
  const email = `${label}-${uid()}@example.test`;
  const password = 'password123';
  const reg = await call('POST', '/api/auth/register', { body: { name: `Test ${label}`, email, password } });
  const login = await call('POST', '/api/auth/login', { body: { email, password } });
  return { id: reg.body.id, email, password, token: login.body.token, user: login.body.user };
}

/** Log in as a seeded provider ('alex' | 'sam'). Seed data is demo-only. */
export async function providerLogin(who) {
  const login = await call('POST', '/api/auth/login', { body: { email: `${who}@salon.test`, password: 'password123' } });
  const providers = (await call('GET', '/api/providers')).body;
  const profile = providers.find((p) => p.id === login.body.user.providerId);
  return { token: login.body.token, providerId: profile.id, profile };
}

/**
 * Per-test cleanup registry. Call `cleanup.add(async () => ...)`; everything runs
 * (in reverse order) after each test, even if the test failed.
 */
export function useCleanup() {
  const fns = [];
  afterEach(async () => {
    while (fns.length) {
      try { await fns.pop()(); } catch { /* best effort */ }
    }
  });
  return { add: (fn) => fns.push(fn) };
}

/** Book an appointment and register its cancellation for cleanup. */
export async function book(cleanup, { token, input, cancelWith }) {
  const res = await call('POST', '/api/appointments', { token, body: input });
  if (res.status === 201) {
    const { id, manageToken } = res.body;
    cleanup.add(() => call('DELETE', `/api/appointments/${id}`, { token: cancelWith, manageToken }));
  }
  return res;
}
