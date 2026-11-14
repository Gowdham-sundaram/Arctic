# ARCTIC — Technical Decisions

This is the initial decision log. Revisit decisions when implementation evidence or a real constraint warrants it.

## Product decisions

### TD-001: ARCTIC identity and independent positioning

- **Decision:** The application is named ARCTIC — Asset Reliability & Condition Tracking Intelligence Centre.
- **Rationale:** This is the requested project identity, adapted from the supplied offshore asset integrity brief.
- **Constraints:** Do not use the former project name as the product name. Describe ARCTIC as an independent educational/portfolio prototype, not an affiliated or certified operational product.

### TD-002: Synthetic data only

- **Decision:** Use generated illustrative assets, inspections, findings, sensor readings, and demo users.
- **Rationale:** The product is a portfolio demonstration and must not imply access to real operational information.
- **Constraints:** Label synthetic content and illustrative calculations in the UI and documentation.

### TD-003: Build incrementally

- **Decision:** Deliver tested vertical slices rather than generating the entire product at once.
- **Rationale:** Smaller changes are easier to review, validate, and maintain.
- **First slice:** Persisted asset registry, followed by authentication and the inspection/anomaly/work-order workflow.

## Technology decisions

### TD-004: TypeScript monorepo

- **Decision:** Use React, Vite, and TypeScript for the frontend; Node.js, Express, and TypeScript for the API; organize them as a monorepo.
- **Rationale:** This matches the supplied stack and allows shared types/validation where useful.
- **Validation:** Confirm compatible versions and available local tooling during foundation work. Keep strict type checking enabled.

### TD-005: PostgreSQL and Prisma

- **Decision:** Use PostgreSQL as the primary database and Prisma for schema and migrations.
- **Rationale:** Asset, inspection, anomaly, risk, and work-order relationships are relational and require transactional integrity.
- **Constraint:** Do not add MongoDB without a demonstrated document-oriented requirement.

### TD-006: Zod at boundaries

- **Decision:** Use Zod for request validation and form validation, reusing schemas when practical.
- **Rationale:** Runtime validation complements TypeScript's compile-time checks and can keep UI/API contracts consistent.
- **Constraint:** Server validation is authoritative.

### TD-007: Workflow risk is illustrative

- **Decision:** Implement only a transparent, deterministic, versioned calculation with visible inputs and explanation.
- **Rationale:** Explainability is a core demonstration; a portfolio score must not be mistaken for an engineering-certified safety assessment.
- **Constraint:** No autonomous safety decision or unvalidated predictive-maintenance claim.

### TD-008: Demo authentication is not production identity

- **Decision:** Hash demo passwords with scrypt, store only hashed session tokens server-side, expire sessions, and enforce role permissions in the API.
- **Rationale:** Authentication and permission behavior are important engineering demonstrations.
- **Constraint:** The browser stores the bearer token in session storage for this local demo. Review token storage, rate limiting, and production identity before any public deployment. Demo accounts must be clearly marked.

### TD-009: No-cost local-first operation

- **Decision:** The project must run locally using open-source tools and synthetic data; use Docker Compose for PostgreSQL where available.
- **Rationale:** The required budget is CAD $0 and local operation must not depend on hosting.
- **Constraint:** Do not enable paid infrastructure or billing without explicit user approval.

### TD-010: Tests follow the vertical slice

- **Decision:** Use Vitest for unit tests, Supertest for API integration tests, and Playwright for selected end-to-end workflows.
- **Rationale:** Each level validates distinct behavior; focused tests are preferred over arbitrary coverage targets.
- **First checks:** Input validation and asset persistence, then lifecycle and authorization invariants.

## Open decisions for implementation

- Workspace/package manager and versions, based on installed tooling and compatibility.
- Production identity provider and hardened session deployment strategy.
- Evidence storage beyond synthetic/local references, if a genuine requirement arises.
- Specific zero-cost deployment provider, only after current limits are checked and with no paid activation.
