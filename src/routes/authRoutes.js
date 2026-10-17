import { Router } from 'express';

export function authRoutes({ auth }) {
  const r = Router();
  r.post('/register', (req, res) => res.status(201).json(auth.register(req.body ?? {})));
  r.post('/login', (req, res) => res.json(auth.login(req.body ?? {})));
  r.post('/logout', (req, res) => {
    auth.logout(req.token);
    res.status(204).end();
  });
  r.get('/me', (req, res) => res.json({ user: req.actor }));
  return r;
}
