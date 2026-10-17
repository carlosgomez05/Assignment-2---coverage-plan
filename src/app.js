import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { attachActor, apiNotFound, errorHandler } from './middleware.js';
import { authRoutes } from './routes/authRoutes.js';
import { providerRoutes } from './routes/providerRoutes.js';
import { appointmentRoutes } from './routes/appointmentRoutes.js';
import { settingsRoutes } from './routes/settingsRoutes.js';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

/** Builds the Express app from a services object (see container.js). No global state. */
export function createApp(services) {
  const app = express();
  app.use(express.json());
  app.use(attachActor(services.auth));

  // To add a feature: create src/services/xService.js + src/routes/xRoutes.js, then register both here.
  app.use('/api/auth', authRoutes(services));
  app.use('/api/providers', providerRoutes(services));
  app.use('/api/appointments', appointmentRoutes(services));
  app.use('/api/settings', settingsRoutes(services));
  app.use('/api', apiNotFound);

  app.use(express.static(publicDir));
  app.use(errorHandler);
  return app;
}
