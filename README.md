# RelayCheck Demo Webhook Receiver

Separate NestJS application under test. Receives simulated webhook events,
validates them, and applies business effects idempotently.

Ownership boundaries (see `ARCHITECTURE.md` at the workspace root):

- Owns its demo business tables: `demo_orders`, `processed_events`,
  `business_effects`.
- Persistent idempotency backed by a unique `(consumerName, eventId)`
  constraint; the idempotency record and business effect commit atomically.
- Test-only oracle and fault-injection controls are unavailable outside
  explicit local/test mode (fail closed).
- Does not process real payments and does not write RelayCheck platform
  tables.

Status: skeleton implemented and verified — health endpoint, webhook intake
with strict DTO validation, and the Prisma business-models schema. Persistent
idempotency (unique constraint + atomic transaction) is wired in next; the
webhook currently reports `processed: false`.

## Endpoints

- `GET /api/health` — service health.
- `POST /api/webhooks/demo` — validates a `payment.succeeded` event:
  `eventId` (stable ID), `orderId`, `amount` (positive integer minor units),
  `currency` (3 letters), `occurredAt` (ISO 8601). Unknown or extra fields
  and unsupported event types are rejected with 400.

## Commands

- `npm install` / `npm ci` — install dependencies.
- `npm run lint` — ESLint (strict TS rules, no `any`).
- `npm run type-check` — strict TypeScript check.
- `npm test` — Jest + Supertest e2e suite (validation accept/reject).
- `npm run build` / `npm start` / `npm run start:dev` — build and run on port 3100.

Package manager: **npm** (lockfiles are committed). Node >= 20.