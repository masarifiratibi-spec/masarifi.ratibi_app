# Local Backend Development

## Prerequisites

- Node.js 24
- Docker Desktop
- A local ignored `apps/api/.env` derived from `apps/api/.env.example`

Use only the database URL printed by the local Supabase CLI. Do not place a
hosted or production credential in the local environment file.

## Clean Start

Run from the repository root:

```powershell
npm --prefix apps/api ci
npm --prefix apps/api run supabase:start
npm --prefix apps/api run db:reset
npm --prefix apps/api run db:lint
npm --prefix apps/api run test:db
```

Run the API and worker in separate terminals:

```powershell
npm --prefix apps/api run start:dev
npm --prefix apps/api run start:worker:dev
```

Check health:

```powershell
Invoke-RestMethod http://localhost:3000/health/live
Invoke-RestMethod http://localhost:3000/health/ready
```

The API runs no migration during startup. The worker binds no HTTP port.

## Container Workflow

The Compose file runs only Masarifi processes and reuses the official local
Supabase stack on the host:

```powershell
docker compose --file docker/local/compose.backend.yml up --build
docker compose --file docker/local/compose.backend.yml down
```

## Stop

Stop API and worker with `Ctrl+C`, then stop the official stack:

```powershell
npm --prefix apps/api run supabase:stop
```
