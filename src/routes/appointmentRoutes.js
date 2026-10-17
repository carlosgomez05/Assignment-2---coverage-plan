import { Router } from 'express';

// Anonymous patrons prove ownership with the manage token returned at booking time,
// sent as the "X-Manage-Token" header.
const manageToken = (req) => req.get('x-manage-token');

export function appointmentRoutes({ appointments }) {
  const r = Router();
  r.post('/', (req, res) => res.status(201).json(appointments.create(req.actor, req.body ?? {})));
  r.get('/', (req, res) => res.json(appointments.list(req.actor, req.query)));
  r.get('/:id', (req, res) => res.json(appointments.get(req.actor, req.params.id, manageToken(req))));
  r.patch('/:id', (req, res) =>
    res.json(appointments.update(req.actor, req.params.id, req.body ?? {}, manageToken(req))),
  );
  r.delete('/:id', (req, res) => res.json(appointments.cancel(req.actor, req.params.id, manageToken(req))));
  return r;
}
