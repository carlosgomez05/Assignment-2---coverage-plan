import { describe, it, expect } from 'vitest';
import { call, uid, newPatron } from './support/api.js';

describe('API: register / login', () => {
  it('registers a patron (201) and never returns the password or hash', async () => {
    const email = `reg-${uid()}@example.test`;
    const res = await call('POST', '/api/auth/register', { body: { name: 'Reg User', email, password: 'password123' } });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Reg User', email, role: 'patron', providerId: null });
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it('ignores a client-supplied role: public sign-up never creates a provider', async () => {
    const email = `role-${uid()}@example.test`;
    const res = await call('POST', '/api/auth/register', {
      body: { name: 'Sneaky', email, password: 'password123', role: 'provider' },
    });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('patron');
  });

  it('rejects a duplicate email (409 EMAIL_TAKEN), case-insensitively', async () => {
    const p = await newPatron('dup');
    const res = await call('POST', '/api/auth/register', {
      body: { name: 'Again', email: p.email.toUpperCase(), password: 'password123' },
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it.each([
    ['missing name', { email: 'a@example.test', password: 'password123' }],
    ['missing email', { name: 'A', password: 'password123' }],
    ['malformed email', { name: 'A', email: 'not-an-email', password: 'password123' }],
    ['password too short', { name: 'A', email: 'a@example.test', password: 'short' }],
    ['missing password', { name: 'A', email: 'a@example.test' }],
  ])('rejects invalid registration: %s (400)', async (_label, body) => {
    const res = await call('POST', '/api/auth/register', { body });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('logs in and /me returns the same user', async () => {
    const p = await newPatron('login');
    const me = await call('GET', '/api/auth/me', { token: p.token });
    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({ email: p.email, role: 'patron' });
  });

  it('rejects a wrong password and an unknown email with the same 401', async () => {
    const p = await newPatron('badlogin');
    const wrongPw = await call('POST', '/api/auth/login', { body: { email: p.email, password: 'wrong-password' } });
    const unknown = await call('POST', '/api/auth/login', { body: { email: `nobody-${uid()}@example.test`, password: 'password123' } });
    expect(wrongPw.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrongPw.body.error.code).toBe('BAD_CREDENTIALS');
    expect(unknown.body.error).toEqual(wrongPw.body.error); // does not reveal which emails exist
  });

  it('logout revokes the token (204) and /me becomes anonymous', async () => {
    const p = await newPatron('logout');
    const out = await call('POST', '/api/auth/logout', { token: p.token });
    expect(out.status).toBe(204);
    const me = await call('GET', '/api/auth/me', { token: p.token });
    expect(me.body.user).toBeNull();
  });

  it('treats a garbage bearer token as anonymous', async () => {
    const me = await call('GET', '/api/auth/me', { token: 'not-a-real-token' });
    expect(me.status).toBe(200);
    expect(me.body.user).toBeNull();
  });
});

describe('API: request handling', () => {
  it('returns 400 BAD_JSON for a malformed JSON body', async () => {
    const res = await call('POST', '/api/auth/register', { rawBody: '{not json' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_JSON');
  });

  it('returns 404 ROUTE_NOT_FOUND for an unknown API route', async () => {
    const res = await call('GET', '/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
  });
});
