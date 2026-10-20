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

Status: workspace initialized (T001). Implementation starts at T010.
Tasks and acceptance criteria live in `TASKS.md` at the workspace root.

## Commands

- `npm install` - install dependencies (verified from a clean checkout).

`npm run type-check`, `npm run build`, `npm run test`, and `npm run lint` are
added when their service's phase task lands (see `TASKS.md`). No placeholder
scripts are included, so nothing here fails silently.

Package manager: **npm** (lockfiles are committed). Node >= 20.