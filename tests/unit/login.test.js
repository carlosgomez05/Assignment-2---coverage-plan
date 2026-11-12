import { beforeEach, describe, expect, it } from 'vitest';
import { createAuthService } from '../../src/services/authService.js';
import { createFakeStore } from './support/fakes.js';

// Gap tests added after merging: login, logout, actorFromToken and provider accounts were not covered.
// Requirements used: wrong email or password gives the same 401; email is case-insensitive;
// a logged-out token no longer identifies anyone.
describe('login and sessions', () => {
  let auth;
  const creds = { name: 'Pat Patron', email: 'pat@example.com', password: 'password123' };

  beforeEach(() => {
    auth = createAuthService({ store: createFakeStore() });
    auth.register(creds);
  });

  it('login_CorrectPasswordMixedCaseEmail_ReturnsTokenAndUser', () => {
    const result = auth.login({ email: 'PAT@Example.com', password: creds.password });

    expect(result.token).toMatch(/^[0-9a-f]{48}$/);
    expect(result.user).toMatchObject({ email: 'pat@example.com', role: 'patron' });
  });

  it.each([
    ['wrong password', { email: 'pat@example.com', password: 'wrongpass1' }],
    ['unknown email', { email: 'nobody@example.com', password: 'password123' }],
    ['missing password', { email: 'pat@example.com' }],
    ['missing email', { password: 'password123' }],
  ])('login_%s_ThrowsBadCredentials', (_label, input) => {
    expect(() => auth.login(input)).toThrowError(expect.objectContaining({ status: 401, code: 'BAD_CREDENTIALS' }));
  });

  it('actorFromToken_ValidToken_ReturnsUserWithoutPasswordHash', () => {
    const { token } = auth.login(creds);

    const actor = auth.actorFromToken(token);

    expect(actor.email).toBe('pat@example.com');
    expect(actor.passwordHash).toBeUndefined();
  });

  it('actorFromToken_AfterLogout_ReturnsNull', () => {
    const { token } = auth.login(creds);
    auth.logout(token);

    expect(auth.actorFromToken(token)).toBeNull();
  });

  it.each([undefined, 'not-a-token'])('actorFromToken_%s_ReturnsNull', (token) => {
    expect(auth.actorFromToken(token)).toBeNull();
  });

  it('createProviderAccount_LinksProviderId', () => {
    const user = auth.createProviderAccount({ name: 'Alex', email: 'alex@example.com', password: 'password123', providerId: 'prov-1' });

    expect(user).toMatchObject({ role: 'provider', providerId: 'prov-1' });
  });
});
