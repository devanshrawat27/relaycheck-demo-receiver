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

Status: test oracle implemented and verified (2026-10-20).
Three repeated HTTP deliveries of one event ID result in exactly one
`processed_events` row, one `demo_orders` row, and one `business_effects`
row; duplicates are answered with `{ processed: false, duplicate: true }`.
Concurrent duplicate deliveries behave identically (unique `(consumerName,
eventId)` constraint + single atomic transaction). The test oracle exposes
only minimum assertion state and fails closed unless
`RELAYCHECK_TEST_MODE=true`.

## Endpoints

- `GET /api/health` — service health.
- `POST /api/webhooks/demo` — validates and processes a `payment.succeeded`
  event: `eventId` (stable ID), `orderId`, `amount` (positive integer minor
  units), `currency` (3 letters), `occurredAt` (ISO 8601). Unknown or extra
  fields and unsupported event types are rejected with 400. Responses:
  `{ accepted: true, eventId, processed: true, duplicate: false }` on first
  delivery and `{ ..., processed: false, duplicate: true }` for repeats.
- `GET /api/__test__/orders/:orderId` — **test oracle** (minimum state:
  order status + business-effect count). Registered ONLY when
  `RELAYCHECK_TEST_MODE=true`; otherwise the route does not exist (404).
  Verified fail-closed for both `false` and unset in e2e tests.

## Setup

1. Start PostgreSQL (see the workspace root README).
2. `cp .env.example .env`.
3. `npm ci && npm run db:migrate`.

## Commands

- `npm install` / `npm ci` — install dependencies.
- `npm run db:migrate` — apply Prisma migrations.
- `npm run lint` — ESLint (strict TS rules, no `any`).
- `npm run type-check` — strict TypeScript check.
- `npm test` — Jest + Supertest e2e suites (validation + idempotency,
  including concurrent duplicate deliveries).
- `npm run build` / `npm start` / `npm run start:dev` — build and run on port 3100.

Package manager: **npm** (lockfiles are committed). Node >= 20.