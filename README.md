# RedemptionMart

Hyperlocal marketplace PWA for Redemption City — browse, order, and pay safely
via Paystack. Live demo: **https://redemptionmart.vercel.app**

## What's built (V1 beta)

- Buyer/seller accounts (Supabase Auth)
- Seller shops and product listings
- Browse and search products, cart, checkout
- Orders with delivery or pickup
- Paystack inline payment + server-side verify
- Seller fulfillment (shipped / ready for pickup)
- Buyer confirm received (3% commission recorded)

See `RedemptionMart_Architecture.md` and `RedemptionMart V1 Specification.md`
for full implementation status vs roadmap.

## Prerequisites

- Node.js 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (optional, for local DB)
- Docker Desktop (only if running Supabase locally)

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   Copy `.env.example` to `.env` at the project root:

   ```bash
   cp .env.example .env
   ```

   Fill in Supabase URL, anon key, and service role key from your project dashboard.
   Add `PAYSTACK_SECRET_KEY` for payments (test keys OK for demo).

3. **Apply database migrations**

   Hosted Supabase: run each file in `supabase/migrations/` in order via the
   SQL Editor, or use `npm run db:migrate` if the CLI can reach your project.

4. **Run locally**

   ```bash
   npm run dev
   ```

   - Frontend: http://localhost:5173
   - Backend (payments proxy): http://localhost:3001/health

## Production (Vercel)

Deploy the `frontend/` folder as the Vercel project root (or set root directory
to `frontend` in Vercel settings).

**Environment variables on Vercel:**

| Variable | Notes |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Public anon key |
| `VITE_API_URL` | Leave **empty** (same-origin `/api`) |
| `SUPABASE_URL` | Same as above (server routes) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only — never expose to client |
| `PAYSTACK_SECRET_KEY` | Server only |

Payment API lives in `frontend/api/payments/` as Vercel serverless functions.

## Project structure

```
backend/          Express API for local dev (payments)
frontend/         React PWA + Vercel serverless API
frontend/api/     Production payment routes
shared/types/     Supabase database types
supabase/         SQL migrations
```

## Data models

| Spec name     | Database table        |
|---------------|-----------------------|
| User          | `public.profiles`     |
| SellerProfile | `public.seller_profiles` |
| Product       | `public.products`     |
| Order         | `public.orders` + `order_items` |
| Transaction   | `public.transactions` |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Frontend + local Express API |
| `npm run dev:frontend` | Vite only |
| `npm run dev:backend` | Express only |
| `npm run db:migrate` | Push migrations to linked Supabase |
| `npm run db:types` | Regenerate `shared/types/database.types.ts` |

## Admin users

Set `is_admin = true` on a `profiles` row in Supabase Studio. Admin UI is on
the V1 roadmap; disputes are handled manually until then.

## Submission documents

| Document | Location |
|---|---|
| Architecture | `RedemptionMart_Architecture.md` |
| Go-to-market | `frontend/RedemptionMart_GTM.md` |
| Product spec | `RedemptionMart V1 Specification.md` |
