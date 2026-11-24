// Real application defects found by the API tests (see report, "Failure triage").
//
// Each test states the CORRECT behaviour. While a defect is open it is wrapped in
// `it.fails`, which PASSES while the app is still wrong and turns RED the moment
// someone fixes the bug, as a reminder to delete the marker and move the test into
// the normal suite. Run with STRICT_DEFECTS=1 to see them as ordinary failures.
import { describe, it, expect } from 'vitest';
import { call, futureDate, uid, newPatron, providerLogin, useCleanup, book } from './support/api.js';

const defect = process.env.STRICT_DEFECTS ? it : it.fails;
const cleanup = useCleanup();

describe('API: known defects (input type validation)', () => {
  // DEFECT-1: authService.createUser copies providerId from the request body.
  defect('DEFECT-1 register ignores a client-supplied providerId (patron must have none)', async () => {
    const res = await call('POST', '/api/auth/register', {
      body: { name: 'Sneaky', email: `d1-${uid()}@example.test`, password: 'password123', providerId: 'x' },
    });
    expect(res.status).toBe(201);
    expect(res.body.providerId).toBeNull();
  });

  // DEFECT-2: appointmentService.create calls .trim() on a non-string attendeeName -> TypeError -> 500.
  defect('DEFECT-2 create with a numeric attendeeName returns 400, not 500', async () => {
    const alex = await providerLogin('alex');
    const patron = await newPatron('d2');
    const res = await book(cleanup, {
      token: patron.token, cancelWith: alex.token,
      input: { providerId: alex.providerId, date: futureDate(1), start: '09:00', attendeeName: 123 },
    });
    expect(res.status).toBe(400);
  });

  // DEFECT-3: same for contactEmail (.trim() on a number).
  defect('DEFECT-3 create with a numeric contactEmail returns 400, not 500', async () => {
    const alex = await providerLogin('alex');
    const res = await book(cleanup, {
      cancelWith: alex.token,
      input: { providerId: alex.providerId, date: futureDate(1), start: '09:00', attendeeName: 'G', contactEmail: 123 },
    });
    expect(res.status).toBe(400);
  });

  // DEFECT-4: authService.login assumes email/password are strings.
  defect('DEFECT-4 login with a non-string password or email returns 401/400, not 500', async () => {
    const numericPw = await call('POST', '/api/auth/login', { body: { email: 'alex@salon.test', password: 12345678 } });
    const objectEmail = await call('POST', '/api/auth/login', { body: { email: { a: 1 }, password: 'x' } });
    expect([400, 401]).toContain(numericPw.status);
    expect([400, 401]).toContain(objectEmail.status);
  });
});
