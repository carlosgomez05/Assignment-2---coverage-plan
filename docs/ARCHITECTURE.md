# Booking App

A small web app for booking appointments with service providers (barbershop, salon, etc.).
Node 20+ and Express only. Data is in memory, so it resets when the server restarts.

## Run it

```bash
npm install
npm start          # http://localhost:3000
npm test           # all tests
npm run test:unit
npm run test:integration
```

Demo provider logins (seeded, demo only): `alex@salon.test` / `sam@salon.test`, password `password123`.

## Structure (one concern per folder)

```
src/
  domain/         Pure logic, no I/O: time helpers, slot generation, conflict checks  -> unit tests
  repositories/   Storage behind insert/get/update/where. Swap memoryStore for a DB here
  services/       Business rules: auth, providers, appointments, settings            -> service/API tests
  routes/         Thin Express routers, one file per resource
  container.js    Wires services together (inject store and clock)
  app.js          Builds the Express app, registers routes
  server.js       Starts the server
  seed.js         Demo data
public/           Minimal browser UI (vanilla JS)
tests/
  unit/           Domain logic
  integration/    Full HTTP flows against a real app on a random port, with a fixed clock
```

### Adding a feature
1. Add pure rules to `src/domain/` if there are any.
2. Add `src/services/xService.js` and register it in `container.js`.
3. Add `src/routes/xRoutes.js` and register it in `app.js`.
4. Add tests in the matching `tests/` folder.

## API summary

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login`, `/api/auth/logout` | Bearer token returned by login |
| GET | `/api/providers`, `/api/providers/:id`, `/api/providers/:id/slots?date=YYYY-MM-DD` | Slots carry `available` |
| PUT | `/api/providers/:id/availability` | Provider only: `slotMinutes`, `weeklyHours` |
| POST | `/api/appointments` | Guest, patron or provider. Guests get a `manageToken` |
| GET | `/api/appointments?date=&status=` | Patron: own bookings. Provider: own calendar |
| PATCH / DELETE | `/api/appointments/:id` | Owner, provider, or guest with `X-Manage-Token` header |
| GET / PUT | `/api/settings` | `requireRegistration` (vendor staff only to change) |

## Assumptions (document and revisit with the Product Owner)

- **A1** Times are in the vendor's local time; one timezone, no DST handling.
- **A2** Guests manage bookings with an ID plus a manage code shown once at booking time (no email sent yet).
- **A3** Any provider account acts as vendor admin for settings, until an admin role exists.
- **A4** "Booking for others" means the patron enters the attendee's name. The same attendee is not prevented from being booked with two providers at overlapping times.
- **A5** Changing a provider's slot length or hours does not move existing appointments.
- **A6** Cancelled appointments are kept (status `cancelled`) for history; only `booked` ones block time.
- **A7** Past times cannot be booked; no minimum-notice or cancellation-window rules yet.
- **A8** Provider profiles are created by seed/admin tooling, not by public sign-up.

## Known gaps (natural next steps)

Persistent database, email/SMS confirmations, a services/price catalogue, provider time off and breaks,
vendor admin role, rate limiting on guest booking, accessibility audit of the UI.
