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

Status: regression-proof fixture verified (2026-10-20). The receiver is
idempotent by unique constraint + atomic transaction; a test-only fixture
(`test/fixtures/broken-webhooks.service.ts`, injected via Nest provider
override, never shipped in src/) proves the business-effect assertion fails
for a deliberately non-idempotent implementation and passes for the real
one. `business_effects` is an append-only evidence table; idempotency is
enforced solely by the unique `(consumerName, eventId)` key on
`processed_events`.

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
2. `cp .env.example .env` — this service owns **its own database**
   (`relaycheck_demo` by default); it never touches RelayCheck platform
   tables.
3. `npm ci && npm run db:migrate`.

## Commands

- `npm install` / `npm ci` — install dependencies.
- `npm run db:migrate` — apply Prisma migrations.
- `npm run lint` — ESLint (strict TS rules, no `any`).
- `npm run type-check` — strict TypeScript check.
- `npm test` — Jest + Supertest e2e suites (validation + idempotency,
  including concurrent duplicate deliveries, test-mode gating, and the
  non-idempotent regression fixture).
- `npm run build` / `npm start` / `npm run start:dev` — build and run on port 3100.

Package manager: **npm** (lockfiles are committed). Node >= 20.