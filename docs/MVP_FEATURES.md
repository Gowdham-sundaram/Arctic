# ARCTIC — MVP Feature List

The MVP is complete only when its required workflows are persisted, validated, tested, and documented. Items are grouped by delivery priority; later items are not implied to be part of the first scaffold.

## P0 — Foundation

- [x] Monorepo with React/TypeScript web app and Express/TypeScript API.
- [x] PostgreSQL + Prisma schema/migration and synthetic seed.
- [x] Documented local start and environment setup at CAD $0.
- [x] Runtime health/readiness endpoints and explicit API error format.
- [x] ESLint, Prettier, strict TypeScript, unit/API tests, production build, and CI configuration. CI has not yet run on a hosted runner.

## P1 — Authentication and assets

- [x] Login/logout with scrypt-hashed demo credentials and expiring server-side sessions.
- [x] API authorization for Admin, Engineer, Inspector, and Viewer roles.
- [x] Complete create, read, update, and soft-archive lifecycle.
- [x] Asset schema supports type, location, operational/health status, criticality, and optional parent.
- [x] Search, filters, pagination, list, and detail views.
- [x] Reject invalid parents and circular hierarchy; archived assets remain searchable in history.
- [x] API/role tests and PostgreSQL asset/workflow integration tests are included. PostgreSQL tests require `DATABASE_URL` and were skipped locally.

## P2 — Inspections

- [x] Create and schedule inspections; assign inspector; support Draft, Planned, In Progress, Completed, and Cancelled states.
- [x] Inspection execution screen with checklist items, observations, optional measurements, and synthetic evidence references.
- [x] Record findings and preserve inspection history.
- [x] Validate allowed transitions and require every checklist item to be completed or marked not applicable.

## P3 — Anomalies and risk

- [x] Create/update anomalies linked to an asset and optionally an inspection.
- [x] Support types, severity, assignment, statuses, synthetic evidence references, resolution, and verification notes.
- [x] Record workflow status changes in audit history.
- [x] Calculate and persist a deterministic, illustrative, versioned risk score with input factors and explanation.
- [x] Display the method and limitations; no safety certification claims.

## P4 — Work orders and flagship workflow

- [x] Create work orders linked to assets and optionally anomalies.
- [x] Assign technician, priority, planned/due dates, and lifecycle status.
- [x] Record completion, require engineer verification, and retain verification detail.
- [x] Prevent anomaly closure before required corrective action verification.
- [x] PostgreSQL end-to-end test covers asset → inspection → finding/anomaly → risk → work order → completion → verification → closure; it was skipped locally without PostgreSQL.

## P5 — Operational visibility

- [x] Asset-health KPIs and health/type distributions computed from API data.
- [x] Twelve-case illustrative scenario watchlist spanning condition, integrity, process, maintenance, and data-quality examples.
- [x] Inspection, anomaly, and work-order KPIs.
- [x] Upcoming/overdue inspection status, anomaly/work-order queues, recent activity, and latest illustrative risk distribution.
- [x] Working navigation from dashboard and workflow records to asset details.
- [x] CSV reports for inventory, health, inspection progress, findings/anomalies, risk, and work orders.
- [x] Asset filters and authenticated CSV export for supported reports.

## Implemented beyond MVP scope

- Interactive 3D synthetic viewer with camera controls, model expansion, asset markers, and cathodic-protection display. The viewer supports numbered clickable markers, hover details, search/type/condition filters, pan, zoom-to-pointer, and camera reset. Asset positions are inferred from text locations and remain approximate until verified coordinates or a site model are supplied.

## Still planned beyond MVP

- Sensor monitoring, threshold configuration, and sensor CSV import.
- General CSV import workflow for assets and observations.
- AI-assisted summaries.
- Public cloud deployment and production-grade identity provider.

These are planned capabilities, not MVP acceptance requirements. The API/web workflows and unit tests are implemented; PostgreSQL integration tests still need to run against a configured local or CI database before the MVP can be considered fully verified.

## Quality and safety constraints

- No dead controls; expose only actions that work.
- Server-side validation and authorization for all protected operations.
- Errors must be visible and diagnosable without leaking secrets or stack traces.
- Use synthetic data only and label it.
- Feature flags control availability, never security permissions.
- Do not claim engineering-grade risk, certified decisions, or predictive maintenance.
