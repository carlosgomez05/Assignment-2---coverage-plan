import { describe, it, expect } from 'vitest';
import { createServices } from '../../src/container.js';
import { createMemoryStore } from '../../src/repositories/memoryStore.js';

// Patron registration rules: register, login and token handling.
// Expected results come from the requirements (registration and login in
// docs/ARCHITECTURE.md and the API contract), not from reading the code under test.

// Every test builds its own store and auth service so no test can affect another.
const makeAuth = () => {
  const store = createMemoryStore();
  const { auth } = createServices({ store });
  return auth;
};

const registerWarren = (auth) =>
  auth.register({ name: 'Warren Bwogi', email: 'warren@test.com', password: 'password123' });

// Returns the error a call throws, or fails the test if the call succeeds.
const errorFrom = (fn) => {
  try {
    fn();
  } catch (err) {
    return err;
  }
  throw new Error('expected an error to be thrown, but none was');
};

describe('auth.register', () => {
  it('register_validInput_returnsPublicUserWithoutPassword', () => {
    // Arrange
    const auth = makeAuth();

    // Act
    const result = auth.register({ name: 'Warren Bwogi', email: 'Warren@Test.com', password: 'password123' });

    // Assert
    expect(result.name).toBe('Warren Bwogi');
    expect(result.email).toBe('warren@test.com');
    expect(result.role).toBe('patron');
    expect(result.id).toBeTruthy();
    expect(result.passwordHash).toBeUndefined();
  });

  it('register_passwordExactlyEightCharacters_returnsPublicUser', () => {
    // Arrange
    const auth = makeAuth();

    // Act
    const result = auth.register({ name: 'Warren Bwogi', email: 'warren@test.com', password: '12345678' });

    // Assert
    expect(result.email).toBe('warren@test.com');
  });

  it('register_passwordSevenCharacters_throwsBadRequest', () => {
    // Arrange
    const auth = makeAuth();

    // Act
    const err = errorFrom(() => auth.register({ name: 'Warren Bwogi', email: 'warren@test.com', password: '1234567' }));

    // Assert
    expect(err.status).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
    expect(err.message).toBe('password must be at least 8 characters');
  });

  it('register_invalidEmailFormat_throwsBadRequest', () => {
    // Arrange
    const auth = makeAuth();

    // Act
    const err = errorFrom(() => auth.register({ name: 'Warren Bwogi', email: 'not-an-email', password: 'password123' }));

    // Assert
    expect(err.status).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
    expect(err.message).toBe('a valid email is required');
  });

  it('register_duplicateEmailDifferentCase_throwsEmailTaken', () => {
    // Arrange
    const auth = makeAuth();
    registerWarren(auth);

    // Act
    const err = errorFrom(() =>
      auth.register({ name: 'Warren Again', email: 'WARREN@TEST.COM', password: 'password123' }),
    );

    // Assert
    expect(err.status).toBe(409);
    expect(err.code).toBe('EMAIL_TAKEN');
    expect(err.message).toBe('email already registered');
  });

  it('register_missingName_throwsBadRequest', () => {
    // Arrange
    const auth = makeAuth();

    // Act
    const err = errorFrom(() => auth.register({ name: '', email: 'warren@test.com', password: 'password123' }));

    // Assert
    expect(err.status).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
    expect(err.message).toBe('name is required');
  });
});

describe('auth.login', () => {
  it('login_correctCredentials_returnsTokenAndUser', () => {
    // Arrange
    const auth = makeAuth();
    registerWarren(auth);

    // Act
    const result = auth.login({ email: 'warren@test.com', password: 'password123' });

    // Assert
    expect(result.token).toBeTruthy();
    expect(result.user.email).toBe('warren@test.com');
    expect(result.user.role).toBe('patron');
  });

  it('login_wrongPassword_throwsUnauthorized', () => {
    // Arrange
    const auth = makeAuth();
    registerWarren(auth);

    // Act
    const err = errorFrom(() => auth.login({ email: 'warren@test.com', password: 'wrong-password' }));

    // Assert
    expect(err.status).toBe(401);
    expect(err.code).toBe('BAD_CREDENTIALS');
    expect(err.message).toBe('invalid email or password');
  });

  it('login_unknownEmail_throwsUnauthorized', () => {
    // Arrange
    const auth = makeAuth();
    registerWarren(auth);

    // Act
    const err = errorFrom(() => auth.login({ email: 'nobody@test.com', password: 'password123' }));

    // Assert
    expect(err.status).toBe(401);
    expect(err.code).toBe('BAD_CREDENTIALS');
    expect(err.message).toBe('invalid email or password');
  });

  it('login_emailDifferentCase_returnsToken', () => {
    // Arrange
    const auth = makeAuth();
    registerWarren(auth);

    // Act
    const result = auth.login({ email: 'WARREN@TEST.COM', password: 'password123' });

    // Assert
    expect(result.token).toBeTruthy();
    expect(result.user.email).toBe('warren@test.com');
  });

  it('login_missingPassword_throwsUnauthorized', () => {
    // Arrange
    const auth = makeAuth();
    registerWarren(auth);

    // Act
    const err = errorFrom(() => auth.login({ email: 'warren@test.com', password: undefined }));

    // Assert
    expect(err.status).toBe(401);
    expect(err.code).toBe('BAD_CREDENTIALS');
    expect(err.message).toBe('invalid email or password');
  });

  it('actorFromToken_revokedSession_returnsNull', () => {
    // Arrange
    const auth = makeAuth();
    registerWarren(auth);
    const login = auth.login({ email: 'warren@test.com', password: 'password123' });

    // Act
    auth.logout(login.token);
    const actor = auth.actorFromToken(login.token);

    // Assert
    expect(actor).toBeNull();
  });

  it('actorFromToken_validSession_returnsPatron', () => {
    // Arrange
    const auth = makeAuth();
    registerWarren(auth);
    const login = auth.login({ email: 'warren@test.com', password: 'password123' });

    // Act
    const actor = auth.actorFromToken(login.token);

    // Assert
    expect(actor).not.toBeNull();
    expect(actor.role).toBe('patron');
    expect(actor.email).toBe('warren@test.com');
  });
});
