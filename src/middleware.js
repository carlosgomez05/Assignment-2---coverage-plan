import { AppError } from './errors.js';

/** Sets req.actor from "Authorization: Bearer <token>" (null when anonymous) and req.token. */
export const attachActor = (auth) => (req, _res, next) => {
  const header = req.get('authorization') ?? '';
  req.token = header.startsWith('Bearer ') ? header.slice(7) : null;
  req.actor = auth.actorFromToken(req.token);
  next();
};

export const apiNotFound = (_req, res) =>
  res.status(404).json({ error: { code: 'ROUTE_NOT_FOUND', message: 'route not found' } });

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'BAD_JSON', message: 'request body is not valid JSON' } });
  }
  console.error(err);
  return res.status(500).json({ error: { code: 'INTERNAL', message: 'something went wrong' } });
};
