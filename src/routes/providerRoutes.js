import { Router } from 'express';

export function providerRoutes({ providers }) {
  const r = Router();
  r.get('/', (_req, res) => res.json(providers.list()));
  r.get('/:id', (req, res) => res.json(providers.get(req.params.id)));
  r.get('/:id/slots', (req, res) => res.json(providers.slots(req.params.id, req.query.date)));
  r.put('/:id/availability', (req, res) =>
    res.json(providers.setAvailability(req.actor, req.params.id, req.body ?? {})),
  );
  return r;
}
