# ARCTIC — Project Overview

**ARCTIC** stands for **Asset Reliability & Condition Tracking Intelligence Centre**. It is an independent educational and portfolio prototype for organizing synthetic asset, inspection, condition, anomaly, risk, and corrective-action information.

## Purpose

Engineering teams need a traceable view of which assets they manage, what condition evidence has been recorded, which inspections are due, what findings need attention, and whether corrective actions have been completed and verified. ARCTIC demonstrates how a connected application can support that workflow.

The project is intended to demonstrate end-to-end software engineering: a typed web client, a REST API, relational data modeling, validated workflows, automated tests, deployment practices, and maintainable documentation.

## Positioning and data

ARCTIC is an independent portfolio demonstration. It is not an official product of, affiliated with, or a replacement for any company or operational engineering system. It is not certified for engineering or safety decisions. Use synthetic data only. Clearly label simulated values, illustrative risk calculations, and any AI-assisted content.

## Users and roles

- **Admin:** manage assets and workflows, including engineer verification.
- **Engineer:** manage inspections, anomalies, risk assessments, corrective work, and verification.
- **Inspector:** plan/execute inspections and submit observations and findings.
- **Viewer:** read-only access.

## Implemented MVP capabilities

The current MVP includes:

- API-derived asset and workflow summaries, synthetic trend charts, risk distribution, recent activity, and a filterable 12-case scenario catalogue.
- Authenticated asset registry with parent hierarchy, search, filters, pagination, update, and soft archive.
- Inspection planning, assignment, checklist execution, measurements, observations, and synthetic evidence references.
- Anomaly lifecycle, explainable illustrative risk assessments, and audit history.
- Work orders linked to assets/anomalies, planned/due dates, completion, engineer verification, and closure enforcement.
- Filterable reports and authenticated CSV export.
- An interactive, explicitly illustrative 3D offshore-platform viewer.
- Demo authentication, role-based API authorization, health checks, structured logs, and request IDs.

PostgreSQL asset-persistence and flagship-workflow integration tests are included, but they must be run against a configured database. They were skipped in the current environment because no local database or `.env` is available.

## Planned beyond MVP

Connected sensors, configurable threshold alerts, CSV import, AI-assisted summaries, a production identity provider, and public deployment are not implemented and are not MVP acceptance requirements.

## MVP outcome

The MVP should prove a small, reliable end-to-end path rather than imitate a complete operational platform:

1. Run the web app, API, and PostgreSQL locally at no cost.
2. Authenticate with demo accounts and enforce role permissions on the API.
3. Persist and manage synthetic assets.
4. Plan and complete an inspection against an asset.
5. Record a finding as an anomaly, calculate and explain illustrative risk, and create a linked work order.
6. Record work completion, require engineer verification before closure, and preserve relevant history.
7. Derive dashboard summaries from persisted records.
8. Document and test the workflow.

All demo credentials and data must be clearly identified as local/demo-only.

## Success criteria

- The project starts from documented local setup instructions with no paid dependencies.
- PostgreSQL is the source of truth for MVP application records.
- Core workflow records have valid relationships and are persisted.
- Server-side validation and authorization are exercised by automated tests.
- No control is presented as functional unless it performs an action.
- Risk is explainable and labeled illustrative, not a safety decision.
- CI validates lint, types, tests, and build.
- Known limitations and synthetic-data status are visible in project documentation and the application.
