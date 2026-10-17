import crypto from 'node:crypto';
import { badRequest, conflict, unauthorized } from '../errors.js';

const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) =>
  `${salt}:${crypto.scryptSync(password, salt, 32).toString('hex')}`;

const verifyPassword = (password, stored) => {
  const [salt, hash] = stored.split(':');
  const candidate = Buffer.from(hashPassword(password, salt).split(':')[1], 'hex');
  return crypto.timingSafeEqual(candidate, Buffer.from(hash, 'hex'));
};

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, providerId: u.providerId ?? null });

export function createAuthService({ store }) {
  const findByEmail = (email) => store.users.where((u) => u.email === email.toLowerCase())[0];

  function createUser({ name, email, password, role, providerId = null }) {
    if (!name || typeof name !== 'string') throw badRequest('name is required');
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw badRequest('a valid email is required');
    if (!password || password.length < 8) throw badRequest('password must be at least 8 characters');
    if (findByEmail(email)) throw conflict('email already registered', 'EMAIL_TAKEN');
    return store.users.insert({
      id: crypto.randomUUID(),
      name: name.trim(),
      email: email.toLowerCase(),
      passwordHash: hashPassword(password),
      role,
      providerId,
    });
  }

  return {
    /** Public sign-up: always creates a patron. */
    register: (input) => publicUser(createUser({ ...input, role: 'patron' })),

    /** Used by seed/admin tooling to link a login to a provider profile. */
    createProviderAccount: (input) => publicUser(createUser({ ...input, role: 'provider' })),

    login({ email, password }) {
      const user = email && findByEmail(email);
      if (!user || !password || !verifyPassword(password, user.passwordHash)) {
        throw unauthorized('invalid email or password', 'BAD_CREDENTIALS');
      }
      const token = crypto.randomBytes(24).toString('hex');
      store.sessions.insert({ id: token, userId: user.id });
      return { token, user: publicUser(user) };
    },

    logout: (token) => {
      if (token) store.sessions.update(token, { revoked: true });
    },

    /** Resolve a bearer token to an "actor", or null for anonymous. */
    actorFromToken(token) {
      const session = token && store.sessions.get(token);
      if (!session || session.revoked) return null;
      const user = store.users.get(session.userId);
      return user ? publicUser(user) : null;
    },
  };
}
