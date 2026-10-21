import { beforeEach, describe, expect, it } from 'vitest';
import { createAuthService } from '../../src/services/authService.js';
import { createFakeStore } from './support/fakes.js';

// Patron registration. Requirements used: public sign-up creates a patron; an email must be
// unique; password must be at least 8 characters; a name is required.
describe('register', () => {
  let auth;

  const valid = (overrides = {}) => ({
    name: 'Pat Patron',
    email: 'pat@example.com',
    password: 'password123',
    ...overrides,
  });

  beforeEach(() => {
    auth = createAuthService({ store: createFakeStore() });
  });

  it('register_ValidDetails_ReturnsPatronWithoutPasswordData', () => {
    const result = auth.register(valid());

    expect(result).toMatchObject({ name: 'Pat Patron', email: 'pat@example.com', role: 'patron' });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('register_PasswordOfEightCharacters_IsAccepted', () => {
    const result = auth.register(valid({ password: '12345678' }));

    expect(result.role).toBe('patron');
  });

  it('register_PasswordOfSevenCharacters_ThrowsBadRequest', () => {
    const act = () => auth.register(valid({ password: '1234567' }));

    expect(act).toThrowError(expect.objectContaining({ status: 400 }));
  });

  it('register_WhitespaceOnlyName_ThrowsBadRequest', () => {
    const act = () => auth.register(valid({ name: '   ' }));

    expect(act).toThrowError(expect.objectContaining({ status: 400 }));
  });
});
