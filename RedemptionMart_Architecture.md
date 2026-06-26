# RedemptionMart — Architecture & Design Document

**Version:** 1.1  
**Stage:** V1 Beta — partial implementation (live at https://redemptionmart.vercel.app)  
**Platform:** Progressive Web App (PWA)  
**Last updated:** June 2026

---

## 1. System Overview

RedemptionMart is a hyperlocal marketplace PWA that connects buyers and sellers
within Redemption City. The system facilitates product discovery, ordering, and
secure payments — without buyers needing to physically search for vendors.

This document describes both **what is built today** and **what remains on the
V1 roadmap**, so architecture, product spec, and live demo stay aligned.

---

## 2. Architecture Diagram (As Built — Production)

```
[Buyer / Seller PWA on Vercel]
         │
         ├─ Supabase client (auth, products, orders, RLS-protected reads/writes)
         │
         └─ /api/payments/*  (Vercel serverless functions, same deployment)
                    │
                    ├─ Paystack Initialize + Verify APIs
                    └─ Supabase service role (mark orders paid, record transactions)

[Supabase PostgreSQL]  ←→  [Supabase Auth]
```

**Local development** uses the same frontend plus an Express server on port 3001
(`npm run dev`). Vite proxies `/api` to Express so payment routes work locally
without a separate hosting account.

---

## 3. Platform Choice: PWA

RedemptionMart is built as a Progressive Web App — not a native Android or iOS
app. This means:

- Users open a link (shareable via WhatsApp) — no app store download required
- The app can install to a home screen on Android (manifest + service worker via Vite PWA plugin)
- Offline caching of static assets is supported by the service worker

**Planned (not yet live):** Web Push notifications for seller order alerts.

**Why PWA over native:** Nothing in V1 requires OS-level access (no background
GPS, no microphone). The community is WhatsApp-first, so link-based sharing
maps directly to how products spread. A native shell (Capacitor/TWA) can
be added later for Play Store presence without rebuilding the app.

---

## 4. Frontend

| Property | Decision (implemented) |
|---|---|
| Framework | React 19 + Vite 6 |
| Language | TypeScript |
| PWA | `vite-plugin-pwa` (manifest + service worker) |
| Styling | Custom CSS (`frontend/src/index.css`) — mobile-first layout |
| State | React Context (`AuthContext`, `CartContext`) |
| Payments UI | Paystack inline popup (`@paystack/inline-js`) |
| Hosting | **Vercel** (production) |

**Planned for V1 (not yet implemented):** map display for seller locations;
image upload to Supabase Storage (sellers currently paste an image URL).

**Why TypeScript:** Catches data shape mismatches and missing fields before
runtime — important for a payments-adjacent product built iteratively.

---

## 5. Backend & API

| Property | Decision (implemented) |
|---|---|
| Production API | Vercel serverless functions in `frontend/api/` |
| Local dev API | Express + TypeScript in `backend/` |
| Database access | Supabase JS client (anon key in browser; service role in API routes) |
| Schema management | SQL migrations in `supabase/migrations/` (not an ORM) |
| Business logic | PostgreSQL functions (`place_order`, `confirm_order_received`, etc.) |

### Payment API routes (production)

| Route | Purpose |
|---|---|
| `POST /api/payments/initialize` | Creates Paystack transaction; returns `access_code` for popup |
| `GET /api/payments/verify/:reference` | Verifies payment with Paystack; marks order paid; inserts `transactions` row |

All Paystack secret keys live in server environment variables only.

---

## 6. Database

**PostgreSQL via Supabase** — relational structure for orders, transactions, and
payouts. Migrations are applied via Supabase SQL Editor or `npm run db:migrate`.

### Core tables (implemented)

**profiles** (spec: `User`)
- `id` (same UUID as `auth.users`), `display_name`, `phone`
- `is_buyer`, `is_seller`, `is_admin` role flags
- Created automatically on signup via DB trigger

**seller_profiles** (spec: `SellerProfile`)
- `user_id`, `shop_name`, `description`
- `latitude`, `longitude`, `address`
- `bank_account_number`, `bank_code`, `paystack_recipient_code` (for future payouts)

**products**
- `seller_id`, `name`, `description`, `price`
- `image_url` (single URL field in V1; not an array yet)
- `status`: `active` | `sold_out`

**orders** + **order_items**
- `buyer_id`, `seller_id`, `total`, `fulfillment_type` (`delivery` | `pickup`)
- `delivery_address`, `payment_status` (`unpaid` | `paid`)
- Line items stored in `order_items` with snapshot of product name and price

**Order status flow (implemented):**
`pending` → `confirmed` → `shipped` or `ready_for_pickup` → `completed` | `cancelled` | `disputed`

**transactions**
- `order_id`, `paystack_reference`, `amount`
- `commission_amount` (3%, calculated when buyer confirms receipt)
- `payout_status`: `pending` | `processing` | `paid` | `failed`

### Tables planned for V1 (not yet migrated)

**reviews** — star rating + comment on completed orders  
**disputes** — buyer “Report a Problem” flow with admin resolution

Row Level Security (RLS) is enabled on all public tables so users cannot read
or modify other users’ data.

---

## 7. Authentication

**Supabase Auth** (implemented)

- Email/password signup and login
- `auth.users` managed by Supabase
- `public.profiles` linked by user UUID; seller flag set when shop is created
- RLS policies enforce per-user data access

---

## 8. Payments: Paystack

### Implemented flow

1. Buyer places order → `place_order()` RPC creates order (`pending`, `unpaid`).
2. Buyer taps **Pay now** → frontend calls `/api/payments/initialize`.
3. Paystack inline popup opens; buyer pays (card, bank transfer, USSD in test/live).
4. After payment, frontend calls `/api/payments/verify/:reference`.
5. Server verifies with Paystack API, sets `payment_status = paid`, records `transactions` row.
6. Seller marks order **Shipped** or **Ready for pickup** (only after paid).
7. Buyer taps **Confirm received** → `confirm_order_received()` sets status `completed`,
   calculates 3% commission, sets `payout_status = pending`.

Funds are held in the platform Paystack balance until buyer confirmation — the
escrow *intent* matches the product spec. Seller bank transfer via Paystack
Transfers API is **queued but not yet automated** (`payout_status` stays `pending`).

### Planned for V1 (not yet implemented)

- Paystack **webhooks** (`charge.success`) as a backup to client-side verify
- Paystack **Transfers** to seller bank on confirm received
- Auto-cancel cron after 120 hours in `shipped` / `ready_for_pickup`
- Refund handling for disputed/cancelled paid orders

**Security rules (implemented):**
- Paystack secret key in environment variables only
- Payment verification and order updates run server-side (Vercel functions / Express)
- No payment secrets in frontend bundle

---

## 9. File Storage

**Current:** Sellers provide a product image URL when listing (external link).

**Planned:** Supabase Storage bucket for uploaded photos with compression on upload.

---

## 10. Push Notifications

**Planned for V1** — not yet implemented.

Intended uses:
- Seller: new order alert
- Buyer: order status changes
- Buyer: 72-hour warning before auto-cancel window

---

## 11. Admin Panel

**Planned for V1** — not yet implemented.

Admin users are identified by `profiles.is_admin = true` (set manually in Supabase).
Future panel: open disputes, order detail, manual refund/release, commission totals.

---

## 12. Security Considerations

- HTTPS enforced on Vercel production
- Supabase RLS on all user-facing tables
- Service role key used only in serverless/API code, never exposed to browser
- `.env` files gitignored; secrets configured in Vercel project settings
- Input validation on payment API routes

**Planned:** Paystack webhook signature validation; rate limiting on auth/payment endpoints.

---

## 13. Deployment

| Layer | Platform (production) |
|---|---|
| Frontend + payment API | **Vercel** (`frontend/` root, `vercel.json` SPA rewrites) |
| Database + Auth | **Supabase** (hosted PostgreSQL) |
| Local dev | `npm run dev` — Vite + Express on localhost |

### Required Vercel environment variables

- `PAYSTACK_SECRET_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (build-time, client)
- `VITE_API_URL` — leave **empty** on Vercel (same-origin `/api`)

---

## 14. V1 Implementation Status

| Feature | Status |
|---|---|
| Sign up / log in | ✅ Live |
| Create shop, add products | ✅ Live |
| Browse + search products | ✅ Live |
| Cart, place order (delivery/pickup) | ✅ Live |
| Paystack checkout (inline popup) | ✅ Live |
| Payment verify + receipt | ✅ Live |
| Seller confirm → shipped / ready for pickup | ✅ Live |
| Buyer confirm received + 3% commission + seller payout | ✅ Live (Paystack Transfer) |
| Reviews after completed orders | ✅ Live |
| Disputes / Report a Problem + admin panel | ✅ Live |
| Push notifications for sellers | ✅ Live (needs VAPID keys) |
| Maps for seller location | ✅ Live |
| Supabase Storage photo upload | ✅ Live |
| Paystack webhooks | ✅ Live (configure URL in Paystack) |
| Auto-cancel after 120 hours | ✅ Live (Vercel cron + CRON_SECRET) |

---

## 15. Out of Scope for V1

- Services marketplace (profile + contact, not catalog + buy)
- Live streaming of Redemption Camp programs
- Physical pickup stations (direct seller pickup only in V1)
- Automated dispute resolution
- Native app / Play Store wrapper
