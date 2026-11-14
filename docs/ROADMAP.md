# ARCTIC — Roadmap

The authentication, asset, inspection, anomaly/risk, work-order, dashboard, reporting, and synthetic 3D MVP phases are implemented. PostgreSQL integration and browser verification remain to be run with the required local services. Sensor/import and deployment items remain planned.

## Phase 1 — Foundation and product definition

- Record ARCTIC-specific requirements, architecture, technical decisions, MVP scope, and constraints.
- Establish monorepo tooling, strict TypeScript, lint/format, environment configuration, and CI.
- Scaffold web and API health route; start PostgreSQL locally with Docker Compose.
- Add seed strategy and initial automated checks.

## Phase 2 — Authentication and asset registry

- [x] Add demo login, scrypt password hashing, expiring sessions, and role-based API authorization.
- [x] Model assets and parent hierarchy; implement CRUD, soft archive, search/filter, and pagination.
- [x] Add asset list/detail pages, hierarchy, and archived-record history.
- [x] Test validation, permissions, persistence, and invalid/circular parent relationships. PostgreSQL tests are present but not run locally.

## Phase 3 — Inspection vertical slice

- [x] Add inspection planning, assignment, statuses, checklist execution, observations, and synthetic evidence references.
- [x] Implement inspection list and execution UX.
- [x] Validate lifecycle transitions and preserve inspection history.

## Phase 4 — Anomalies and explainable risk

- [x] Link findings to assets and inspections; implement anomaly lifecycle and audit events.
- [x] Implement deterministic, versioned illustrative risk calculation with stored inputs and explanation.
- [x] Test risk thresholds and visibly state limitations.

## Phase 5 — Corrective work orders

- [x] Add work order creation, assignment, priority, planned/due dates, progress, completion, and verification.
- [x] Enforce verification-before-closure rules across API and UI.
- [x] Add a PostgreSQL flagship workflow integration test. Execution is pending a configured database.

## Phase 6 — Dashboard and reporting

- [x] Asset-health KPIs, health/type distributions, and synthetic condition trend charts derived from API data.
- [x] Add a filterable, 12-case illustrative scenario watchlist covering integrity, process, instrumentation, maintenance, and data-quality examples.
- [x] Derive workflow KPIs, overdue counts, recent activity, and latest illustrative risk distribution from API data.
- [x] Add asset-filtered reports and authenticated CSV export for inventory, health, inspections, anomalies, risk, and work orders.
- [x] Link workflow records to asset detail pages. Dashboard metrics reflect persisted workflow state.

## Phase 7 — 3D viewer

- [x] Build an interactive synthetic offshore scene with camera presets, selection, status markers, and navigation to asset details.
- [x] Handle rendering/loading errors and label geometry and telemetry as illustrative.

## Phase 8 — Sensors and data import

- Add synthetic sensor readings, trends, configurable thresholds, and threshold alerts.
- Add CSV preview, column/data validation, duplicates and relationship checks, explicit row errors, transaction-safe import, and summary.

## Phase 9 — Quality and release readiness

- [x] Add API/role tests, negative-path checks, and PostgreSQL asset/workflow integration tests. PostgreSQL tests remain unexecuted locally.
- [x] Add structured logging, request IDs, health/readiness checks, and explicit error responses.
- [ ] Complete browser/accessibility verification and hosted CI run.
- [x] Document Docker instructions and known limitations; public deployment remains outside this MVP.

## Phase 10 — Portfolio presentation

- Prepare screenshots, demo instructions, architecture diagrams, test results, and a concise technical case study.
- Consider a zero-cost public demo only after validating provider limits and privacy; never activate paid billing without explicit approval.

## Initial scaffold plan (historical)

The steps below recorded the original project scaffold. The implementation has since expanded through the core workflow, dashboard, and reporting phases above.

1. Confirm this documentation against the chosen ARCTIC scope and preserve synthetic-data/portfolio positioning.
2. Check local Node, package-manager, Docker, and Git availability before selecting exact scaffold commands.
3. Add a minimal monorepo with a Vite React client, Express API, shared TypeScript/validation where useful, and PostgreSQL/Prisma.
4. Add local environment templates, a Compose database service, seed script, and health endpoints.
5. Add lint, type-check, unit-test, API-test, and build commands plus CI.
6. Deliver the first tested vertical slice as asset persistence: create/list/detail assets, request validation, basic role-ready API boundary, and a focused integration test.
7. Present the scaffold and verification results before expanding into authentication and the complete operational workflow.

## First vertical slice (implemented)

**Asset registry persistence** is implemented: a user can submit a validated synthetic asset through the web client, the API persists it in PostgreSQL, and the asset appears in a filterable list and detail view. The inspection-to-anomaly-to-risk-to-work-order workflow is implemented with a PostgreSQL integration test; that test still needs to run against an available database.
