import { Router } from 'express';

export function settingsRoutes({ settings }) {
  const r = Router();
  r.get('/', (_req, res) => res.json(settings.get()));
  r.put('/', (req, res) => res.json(settings.update(req.actor, req.body ?? {})));
  return r;
}
