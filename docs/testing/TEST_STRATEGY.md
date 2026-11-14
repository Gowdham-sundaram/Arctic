# ARCTIC — Testing Strategy

## Principles

- Test user-visible behavior and domain invariants, not implementation details.
- Keep synthetic data deterministic and visibly synthetic.
- Run fast unit and API checks on every change; use the real database in CI where available.
- Treat validation, authorization, workflow transitions, and error responses as first-class behaviors.
- Report exactly which checks ran; a successful build is not evidence that an unrun integration workflow works.

## Test levels

### Unit tests — Vitest

Current focused unit coverage includes:

- Illustrative risk score boundaries, category, version, and limitation text.
- Login and asset request validation, protected-route behavior, and response/error shapes are exercised through API tests.

### API tests — Vitest and Supertest

Exercise HTTP routes, response shapes, validation, error status codes, role authorization, asset lifecycle, CSV export, and repository interactions. The route tests use controlled in-memory repositories; PostgreSQL-backed tests verify persistence, hierarchy constraints, archive history, and the flagship workflow when `DATABASE_URL` is configured.

Current route cases:

- Login, resolve, and revoke a session.
- Reject malformed asset data and invalid pagination.
- Enforce session and role requirements on protected endpoints.
- Create, update, archive, and retrieve an archived asset.
- Export authenticated CSV and escape spreadsheet-formula values.
- Distinguish application health from database readiness.

PostgreSQL integration cases:

- Persist/read/search an asset; reject missing and circular parents; retain archived history.
- Complete inspection → anomaly → risk → work order → completion → engineer verification → anomaly closure.
- Verify that closure is rejected before the corrective work order is verified.

Integration tests load the root `.env` when run from the API workspace and are skipped if `DATABASE_URL` is unavailable.

### End-to-end — Playwright

Browser automation and accessibility checks are still pending. Priority workflows:

1. Login → dashboard → asset → inspection → complete inspection.
2. Login → asset → anomaly → risk assessment → work order.
3. Login → work order → completion → verification → anomaly closure.
4. Login → filtered report → authenticated CSV download.
5. Login → 3D viewer → select asset → open asset details.

The browser workflows should be smoke-tested against a local PostgreSQL instance after setup; no browser automation suite is currently configured.

## Local commands

- `npm test` — automated unit and API tests.
- `npm run typecheck` — strict TypeScript checks.
- `npm run lint` — ESLint.
- `npm run build` — web production build and API type/build validation.
- `npm run format:check` — Prettier verification.

## CI

GitHub Actions provisions PostgreSQL and runs dependency installation, Prisma client generation, migrations, lint, type-check, tests, and build.

## Current limitations

- Docker and PostgreSQL are not installed in the current development environment; database-backed persistence and workflow tests could not yet be exercised here.
- The hosted CI workflow provisions PostgreSQL and runs migrations and automated checks, but has not yet been observed on a hosted runner.
- Browser automation and accessibility checks remain future validation work.
