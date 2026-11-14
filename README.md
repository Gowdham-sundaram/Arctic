# ARCTIC

**Asset Reliability & Condition Tracking Intelligence Centre**

ARCTIC is an independent educational and portfolio prototype for organizing synthetic asset and inspection information. It is not affiliated with or a replacement for any operational engineering product, and it is not certified for engineering or safety decisions. Risk and condition data are illustrative.

## Status

The MVP includes role-based demo login, an API-backed asset registry with soft archive and hierarchy validation, inspection/checklist execution, anomaly and illustrative risk workflows, corrective work orders with engineer verification, audit history, workflow KPIs, and authenticated CSV reports. The web app also includes an interactive offshore-platform view, synthetic trend charts, and a 12-case illustrative scenario watchlist. The seed contains 30 synthetic assets and four demo roles. All records and scores are illustrative, not live monitoring or engineering decisions.

## Requirements

- Node.js 24 or newer
- npm
- Docker Desktop or another Docker Compose installation for local PostgreSQL

The application code and local tools are designed for CAD $0. No paid services or external AI APIs are required.

## Local setup

1. Copy `.env.example` to `.env` and set `DEMO_USER_PASSWORD` to a local password of at least 12 characters. All four demo accounts use this password.
2. Install dependencies: `npm ci`.
3. Start the database: `docker compose up -d postgres`.
4. Generate the Prisma client and apply migrations:
   - `npm run db:generate`
   - `npm run db:migrate`
5. Seed the synthetic assets and demo users: `npm run db:seed`.
6. Start both apps: `npm run dev`.
7. Open `http://localhost:5173` and sign in with one of:
   - `admin@arctic.demo`
   - `engineer@arctic.demo`
   - `inspector@arctic.demo`
   - `viewer@arctic.demo`

   Use the local `DEMO_USER_PASSWORD` value for the selected account. The API is on `http://localhost:4000`; health is at `/api/v1/health`.

Do not put real operational or sensitive data in this demonstration.

On Windows PowerShell, if the `npm` PowerShell script is blocked by execution policy, use `npm.cmd` instead (for example, `npm.cmd ci` and `npm.cmd run dev`); no policy change is required.

## Validation commands

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run format:check`

## Documentation

- [Free hosting and deployment guide](docs/deployment/FREE_HOSTING.md)
- [Project overview](docs/PROJECT_OVERVIEW.md)
- [Architecture](docs/ARCHITECTURE.md)
- [MVP feature list](docs/MVP_FEATURES.md)
- [Roadmap](docs/ROADMAP.md)
- [Technical decisions](docs/TECHNICAL_DECISIONS.md)
- [Testing strategy](docs/testing/TEST_STRATEGY.md)

## Limitations

Sensor monitoring/import, AI-assisted summaries, a production identity provider, and public deployment remain outside the MVP. The Prisma schema validates and unit/API tests pass. PostgreSQL persistence and flagship workflow integration tests are included, but they could not be run in this environment because Docker/PostgreSQL and a local `.env` are unavailable; run them after completing local setup. Do not treat demo data, scenario prompts, or illustrative risk scores as operational functionality.
