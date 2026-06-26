# RedemptionMart

Local marketplace for Redemption City — React PWA frontend, Express backend, Supabase PostgreSQL.

## Prerequisites

- Node.js 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npm install -g supabase`)
- Docker Desktop (required for local Supabase: `supabase start`)

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   Copy `.env.example` to `.env` at the project root and fill in values from your Supabase project dashboard (Settings → API):

   ```bash
   cp .env.example .env
   ```

   For the frontend, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the same URL and anon key.

3. **Start Supabase locally** (requires Docker)

   ```bash
   supabase start
   ```

   After the first start, run migrations:

   ```bash
   npm run db:migrate
   ```

   Or reset the local database (applies all migrations from scratch):

   ```bash
   npm run db:reset
   ```

4. **Regenerate TypeScript types** (after migrations)

   ```bash
   npm run db:types
   ```

5. **Run development servers**

   ```bash
   npm run dev
   ```

   - Backend: http://localhost:3001/health
   - Frontend: http://localhost:5173

## Remote Supabase project

If using a hosted Supabase project instead of local:

1. `supabase link --project-ref YOUR_PROJECT_REF`
2. `npm run db:migrate` (pushes migrations to remote)
3. Update `.env` with your project's URL and keys
4. `supabase gen types typescript --linked > shared/types/database.types.ts`

## Project structure

```
backend/          Express API (service-role Supabase client)
frontend/         React + Vite PWA
shared/types/     Generated Supabase database types
supabase/         SQL migrations and Supabase config
```

## Data models (V1)

| Spec name       | Database table       | Notes                                      |
|-----------------|----------------------|--------------------------------------------|
| User            | `public.profiles`    | Linked to `auth.users`; role flags         |
| SellerProfile   | `public.seller_profiles` | Shop info, location, bank details    |

## Smoke tests

After migrations are applied, verify the User and SellerProfile models:

### 1. Signup creates a profile row

1. Open Supabase Studio (local: http://127.0.0.1:54323, or your hosted dashboard).
2. Go to **Authentication → Users** and create a test user (email + password).
3. Go to **Table Editor → profiles** and confirm a row exists with `id` matching the new user's UUID.
4. Check defaults: `is_buyer = true`, `is_seller = false`, `is_admin = false`.

### 2. Seller profile FK and is_seller flag

1. In **Table Editor → seller_profiles**, insert a row:
   - `user_id`: the test user's profile `id`
   - `shop_name`: e.g. "Test Shop"
   - `address`: e.g. "Redemption City"
   - `latitude` / `longitude`: optional coordinates
2. Confirm the row is created and `user_id` references `profiles.id`.
3. Confirm `profiles.is_seller` was automatically set to `true` for that user (DB trigger).

### 3. Row Level Security

**Profiles (own row):**

1. Sign in as the test user via the Supabase client or Auth UI.
2. Query `profiles` filtered by your user id — should succeed.
3. Attempt to update another user's profile — should fail.

**Seller profiles (read for buyers, CRUD for owner):**

1. As the seller user, insert/update/delete your own `seller_profiles` row — should succeed.
2. As a different authenticated user, `SELECT` on `seller_profiles` — should succeed (buyers need shop info).
3. As a different user, attempt to update someone else's seller profile — should fail.

### 4. Backend health check

```bash
curl http://localhost:3001/health
```

Expected: `{"status":"ok"}`

## Scripts

| Command            | Description                          |
|--------------------|--------------------------------------|
| `npm run dev`      | Start backend + frontend             |
| `npm run dev:backend` | Express API only                  |
| `npm run dev:frontend`| Vite dev server only              |
| `npm run db:migrate`  | Push migrations to Supabase       |
| `npm run db:reset`    | Reset local DB and re-run migrations |
| `npm run db:types`    | Regenerate `shared/types/database.types.ts` |

## Admin users

Set `is_admin = true` on a profile row manually in Supabase Studio (no admin UI in V1 yet).
