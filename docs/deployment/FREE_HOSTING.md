# Free hosting guide

This guide deploys the ARCTIC portfolio demo using Cloudflare Pages for the
frontend, Render for the API, and Neon for PostgreSQL. Free-tier limits and
provider terms can change; confirm them in each provider's dashboard before
deploying. This setup is for a synthetic-data demo, not operational use.

## Before deploying

1. Push the repository to a Git provider account that Cloudflare Pages and
   Render can access.
2. Create a Neon project and database. Copy its pooled PostgreSQL connection
   string and keep it private.
3. Use viewer-only seeding for a public demo. This creates only the viewer
   account and deactivates the other seeded demo accounts, if present.

## Deploy the API

Create a Render **Web Service** from the repository:

- Root directory: repository root
- Build command:
  `npm ci && npm run db:generate --workspace @arctic/api && npm run build --workspace @arctic/api`
- Start command: `npm run start --workspace @arctic/api`
- Health check path: `/api/v1/ready`

Configure these environment variables in Render:

- `DATABASE_URL`: the Neon pooled connection string
- `WEB_ORIGIN`: the deployed Cloudflare Pages origin, for example
  `https://arctic-demo.pages.dev`
- `LOG_LEVEL`: `info`

Render provides `PORT`; the API listens on it and falls back to `API_PORT` (4000)
for local development. The readiness check verifies database connectivity.

After the API service is available, run the migration command once against the
production database:

```sh
npm run db:deploy --workspace @arctic/api
```

Run this with the production `DATABASE_URL` set. Seed only synthetic data. For a public viewer-only demo, set
`DEMO_ACCESS_MODE=viewer-only` and a unique `DEMO_USER_PASSWORD` of at least
12 characters, then run `npm run db:seed`. Viewer-only mode disables the other
seeded demo accounts so their higher-privilege roles cannot be used. Do not use
this password for any other account.

## Deploy the frontend

Create a Cloudflare Pages project connected to the same repository:

- Root directory: repository root
- Build command: `npm ci && npm run build --workspace @arctic/web`
- Build output directory: `apps/web/dist`
- Build environment variable `VITE_API_BASE_URL`:
  `https://<your-render-service>.onrender.com/api/v1`
- Build environment variable `VITE_DEMO_VIEWER_PASSWORD`: the same value as
  `DEMO_USER_PASSWORD` used when seeding the viewer-only account.

Replace the example API URL with the Render service's actual URL. Once the
Pages deployment has its final URL, set that exact origin as Render's
`WEB_ORIGIN` and redeploy the API.

`VITE_DEMO_VIEWER_PASSWORD` is embedded in the public frontend so visitors can
sign in. This is intentional for the read-only synthetic demo; use it only
when the production database has been seeded in viewer-only mode.

## Verify the deployment

1. Open `https://<your-render-service>.onrender.com/api/v1/health` and confirm
   it returns `{"status":"ok"}`.
2. Open `/api/v1/ready` and confirm the database is reachable.
3. Open the Cloudflare Pages site and test login and the main asset/workflow
   pages.
4. Check Render logs and both providers' usage dashboards after testing.

The free Render API sleeps after inactivity, so the first request can be slow.
Neon also scales its free database to zero. Free hosting has no production
uptime guarantee, and the database plan's storage, compute, and transfer quotas
apply.

## Updating the published app

Cloudflare Pages and Render can deploy from the connected Git repository.
After making and testing a change locally, push it to the tracked branch; each
provider builds and deploys the updated service. For database schema changes,
commit a Prisma migration and run `npm run db:deploy --workspace @arctic/api`
against the hosted database as part of the rollout. Keep `DATABASE_URL` and
other secrets only in provider environment settings.

You can later upgrade hosting plans or add capabilities such as a custom
domain, managed backups, a non-sleeping API, staging deployments, or a
production identity provider. Review the cost and security implications before
enabling paid features or storing anything other than synthetic data.
