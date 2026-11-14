# ARCTIC — Proposed Architecture

## Goals and constraints

- Keep the initial system understandable as a portfolio project while preserving clear web/API boundaries.
- Use the requested React/TypeScript and Node.js/TypeScript stack.
- Treat PostgreSQL as the authoritative store for related workflow data.
- Validate all external input and enforce authorization on the server.
- Keep the local development and demo path at CAD $0.
- Make synthetic data and illustrative risk unmistakable.

## Proposed repository layout

```text
ARCTIC/
├── apps/
│   ├── web/                 # React, Vite, TypeScript client
│   └── api/                 # Express, TypeScript REST API
├── packages/
│   ├── shared/              # Shared domain types and utilities
│   └── validation/          # Shared Zod schemas where appropriate
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── docs/
│   ├── features/
│   ├── testing/
│   ├── deployment/
│   └── decisions/
├── tests/
│   └── e2e/
├── docker-compose.yml
├── package.json
└── README.md
```

The exact package-manager and workspace setup will be chosen during foundation work after checking installed tooling and compatibility. Avoid adding MongoDB: PostgreSQL already supports the relational workflow and flexible JSON fields if a justified need emerges.

## Runtime shape

```text
Browser
  └── React + TypeScript + Vite
       └── REST/JSON over same-origin or configured API URL
            └── Express + TypeScript
                 ├── request ID, logging, authentication and authorization
                 ├── Zod request/response validation
                 ├── domain services (workflow and risk rules)
                 └── Prisma
                      └── PostgreSQL
```

TanStack Query manages server state. React Hook Form and Zod support client-side forms, with server-side validation remaining authoritative. OpenAPI documents the REST contract. Docker Compose provides the local database and application services once the initial scaffold is in place.

## MVP domain model

Recommended primary entities and relationships:

- **User** has a role (`ADMIN`, `ENGINEER`, `INSPECTOR`, `VIEWER`) and authored/assigned records.
- **Asset** has a unique asset identifier, type, status, health, criticality, location, and optional self-referencing parent. Parent relationships must not permit cycles. Archival should be soft so history remains available.
- **Inspection** belongs to an asset and optionally an assigned inspector; it has type, method, schedule, status, notes, and execution dates.
- **ChecklistItem** belongs to an inspection and records prompt, outcome (`PASS`, `FAIL`, `NOT_APPLICABLE`), observation, optional measurement, and evidence reference.
- **Anomaly** belongs to an asset and may reference an inspection; it has type, severity, status, detection details, assignment, resolution, and verification details.
- **RiskAssessment** belongs to an anomaly (and therefore an asset) and stores the input factors, formula/version, score, category, explanation, and assessment timestamp. Persist the inputs so the result is explainable.
- **WorkOrder** belongs to an asset and may reference an anomaly; it records priority, assignment, due date, status, completion, and verification.
- **AuditEvent** records important lifecycle transitions with actor, entity, action, timestamp, and appropriate change context.
- **EvidenceReference** stores metadata and a safe synthetic/local reference, not a third-party file service dependency.
- **SensorReading** belongs to an asset and records type, value, unit, timestamp, source, and validation status; this can follow the core workflow.

Use database constraints and transactions for related state changes. Avoid storing secrets or passwords in plaintext; hash demo-user passwords using a current password-hashing library. Do not expose internal stack traces or sensitive fields in API errors.

## Workflow invariants

- An inspection must refer to an existing asset.
- A finding/anomaly must refer to an existing asset; an optional inspection must be associated consistently.
- Work orders must link to an existing asset and, when provided, a compatible anomaly.
- A work order cannot be verified before completion.
- An anomaly must not be closed until the required corrective action is verified (unless a documented, authorized disposition explicitly permits another path).
- Every important lifecycle transition records its actor and time.
- Risk calculations are deterministic, versioned, and labeled illustrative.

## API conventions

- Versioned REST namespace, such as `/api/v1`.
- Resource-oriented endpoints with predictable status codes and JSON error shapes.
- Parse and validate input at the boundary with Zod; do not rely on browser validation.
- Enforce authentication and role permissions on every protected operation.
- Use pagination and filters for collection endpoints.
- Provide `/health` (liveness) and, when useful, `/ready` (database readiness) endpoints.
- Generate or propagate a request correlation ID and include it in structured logs and error responses.
- Publish OpenAPI documentation and keep it consistent with the implemented API.

## Frontend experience

Use an industrial engineering visual direction: navy base, cyan/blue accents, clear green/amber/red status semantics, accessible contrast, responsive navigation, and consistent page states. Build navigation and page actions only for implemented routes. Provide loading, empty, validation, and error states. The visual design is an original ARCTIC interface, not a reproduction of a proprietary product.

## Security and operations

- Keep credentials and connection strings in environment variables; commit only placeholders in `.env.example`.
- Use secure password hashing and server-side authorization. Feature flags are not permissions.
- Restrict CORS to configured origins; apply safe request limits and error handling appropriate to the app.
- Use structured logs, request IDs, health endpoints, and explicit failures.
- Seed only synthetic data and demo accounts; clearly warn that demo credentials are not production credentials.
- Use no paid APIs or services without explicit approval.

## Test and delivery shape

- Vitest for unit tests of domain rules and calculations.
- Supertest for API integration and authorization tests.
- Playwright for a small number of full user workflows.
- ESLint, Prettier, TypeScript strict checks, and production builds.
- GitHub Actions for dependency install, lint, type-check, tests, and build.
- Cloud deployment is a later optional step; local operation must remain supported if a free host is unavailable.
