import { beforeEach, describe, expect, it } from 'vitest';
import { createAuthService } from '../../src/services/authService.js';
import { createFakeStore } from './support/fakes.js';

// Patron registration. Requirements used: public sign-up creates a patron; an email must be
// valid and unique; password must be at least 8 characters; a name is required.
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

  it('register_RoleSuppliedAsProvider_StillCreatesPatron', () => {
    const result = auth.register({ ...valid(), role: 'provider', providerId: 'prov-1' });

    expect(result.role).toBe('patron');
  });

  it('register_MixedCaseEmail_StoresLowercaseEmail', () => {
    const result = auth.register(valid({ email: 'Pat@Example.COM' }));

    expect(result.email).toBe('pat@example.com');
  });

  it('register_PasswordOfEightCharacters_IsAccepted', () => {
    const result = auth.register(valid({ password: '12345678' }));

    expect(result.role).toBe('patron');
  });

  it('register_PasswordOfSevenCharacters_ThrowsBadRequest', () => {
    const act = () => auth.register(valid({ password: '1234567' }));

    expect(act).toThrowError(expect.objectContaining({ status: 400 }));
  });

  it('register_MissingPassword_ThrowsBadRequest', () => {
    const act = () => auth.register(valid({ password: undefined }));

    expect(act).toThrowError(expect.objectContaining({ status: 400 }));
  });

  it('register_EmailWithoutAtSign_ThrowsBadRequest', () => {
    const act = () => auth.register(valid({ email: 'pat.example.com' }));

    expect(act).toThrowError(expect.objectContaining({ status: 400 }));
  });

  it('register_EmailWithoutDomainDot_ThrowsBadRequest', () => {
    const act = () => auth.register(valid({ email: 'pat@example' }));

    expect(act).toThrowError(expect.objectContaining({ status: 400 }));
  });

  it('register_EmailContainingSpace_ThrowsBadRequest', () => {
    const act = () => auth.register(valid({ email: 'pat smith@example.com' }));

    expect(act).toThrowError(expect.objectContaining({ status: 400 }));
  });

  it('register_MissingName_ThrowsBadRequest', () => {
    const act = () => auth.register(valid({ name: '' }));

    expect(act).toThrowError(expect.objectContaining({ status: 400 }));
  });

  it('register_WhitespaceOnlyName_ThrowsBadRequest', () => {
    const act = () => auth.register(valid({ name: '   ' }));

    expect(act).toThrowError(expect.objectContaining({ status: 400 }));
  });

  it('register_EmailAlreadyRegisteredInDifferentCase_ThrowsEmailTaken', () => {
    auth.register(valid());

    const act = () => auth.register(valid({ email: 'PAT@example.com', name: 'Someone Else' }));

    expect(act).toThrowError(expect.objectContaining({ code: 'EMAIL_TAKEN' }));
  });

  it('register_NameWithSurroundingSpaces_StoresTrimmedName', () => {
    const result = auth.register(valid({ name: '  Pat Patron  ' }));

    expect(result.name).toBe('Pat Patron');
  });
});
