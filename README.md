# Tuition Manager

Phase 0 foundation setup for a monorepo with:

- `apps/web` → Next.js 14 app shell
- `apps/api` → Express + TypeScript API with JWT auth endpoints
- `packages/shared` → shared types/schemas

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Copy environment files:

```bash
copy .env.example .env
copy apps\api\.env.example apps\api\.env
copy apps\web\.env.example apps\web\.env.local
```

3. Update real secrets in `apps/api/.env`.

4. Run Prisma generate + migration:

```bash
npm run prisma:generate --workspace @tuition-manager/api
npm run prisma:migrate --workspace @tuition-manager/api -- --name init_phase0
```

5. Start apps:

```bash
npm run dev:api
npm run dev:web
```

## Available Endpoints (Phase 0)

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/me` (requires Bearer token)
